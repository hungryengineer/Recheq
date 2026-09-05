// ─── Rate Limiting Middleware ───────────────────────────────────
// Store-agnostic fixed-window rate limiter for public token routes.
//
// Production uses a Postgres-backed store (see createSqlRateLimitStore) so the
// limit is enforced across serverless instances and survives restarts. An
// in-memory store is provided for tests and local single-process use.
//
// Keys are per (IP, token) so a candidate's budget is isolated per endpoint
// token, while an abusive IP cannot drain unrelated sessions.

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: number; // epoch ms when the current window ends
  retryAfterSeconds?: number;
}

export interface RateLimitStore {
  /**
   * Atomically increments the counter for (scope, key) within the current
   * window and reports whether the request is still within maxRequests.
   */
  increment(args: {
    scope: string;
    key: string;
    windowMs: number;
    maxRequests: number;
  }): Promise<RateLimitResult>;
}

// ─── In-memory store ────────────────────────────────────────────
interface InMemoryRecord {
  windowStart: number;
  windowEnd: number;
  count: number;
  maxRequests: number;
}

const inMemoryState = new Map<string, InMemoryRecord>();

export function createInMemoryRateLimitStore(): RateLimitStore & {
  clear: () => void;
  getStatus: (mapKey: string) => InMemoryRecord | undefined;
} {
  return {
    async increment({ scope, key, windowMs, maxRequests }) {
      const mapKey = `${scope}:${key}`;
      const now = Date.now();
      let record = inMemoryState.get(mapKey);

      if (!record || now >= record.windowEnd) {
        record = { windowStart: now, windowEnd: now + windowMs, count: 0, maxRequests };
        inMemoryState.set(mapKey, record);
      }

      record.count += 1;
      record.maxRequests = maxRequests;

      if (record.count > maxRequests) {
        return {
          allowed: false,
          count: record.count,
          limit: maxRequests,
          resetAt: record.windowEnd,
          retryAfterSeconds: Math.ceil((record.windowEnd - now) / 1000),
        };
      }

      return { allowed: true, count: record.count, limit: maxRequests, resetAt: record.windowEnd };
    },

    clear() {
      inMemoryState.clear();
    },

    getStatus(mapKey) {
      const record = inMemoryState.get(mapKey);
      if (!record) return undefined;
      const now = Date.now();
      if (now >= record.windowEnd) {
        inMemoryState.delete(mapKey);
        return undefined;
      }
      return record;
    },
  };
}

// ─── Response helpers ───────────────────────────────────────────
export function rateLimitBlockedResponse(result: RateLimitResult): Response {
  const now = Date.now();
  return new Response(
    JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        'Retry-After': String(
          Math.max(1, result.retryAfterSeconds ?? Math.ceil((result.resetAt - now) / 1000)),
        ),
      },
    },
  );
}

// ─── Middleware ─────────────────────────────────────────────────
export interface CreateRateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
}

export function createRateLimiter(
  store: RateLimitStore,
  options: CreateRateLimiterOptions = {},
  scope = 'public',
) {
  const { windowMs = 60_000, maxRequests = 10 } = options;

  return function rateLimit(
    req: Request,
    next: (req: Request) => Promise<Response>,
  ): Promise<Response> {
    const url = new URL(req.url);
    const token = url.pathname.split('/')[3] || 'anonymous'; // /api/public/:token/...
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const key = `${ip}:${token}`;
    return store.increment({ scope, key, windowMs, maxRequests }).then((result) => {
      if (!result.allowed) {
        return rateLimitBlockedResponse(result);
      }
      return next(req);
    });
  };
}
