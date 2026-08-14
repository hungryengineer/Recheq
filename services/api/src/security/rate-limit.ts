// ─── Rate Limiting Middleware ───────────────────────────────────
// Implements rate limiting for public token routes using a sliding window counter
// Stores request counts in memory. In production, use Redis for distributed systems.

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitState {
  [key: string]: RateLimitRecord | undefined;
}

// In-memory storage for rate limiting
// Note: This is reset on server restart. For production, use Redis.
const rateLimitState: RateLimitState = {};

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000, // 1 minute
  maxRequests: 10, // 10 requests per minute per IP + token combination
};

export function createRateLimiter(config: RateLimitConfig = DEFAULT_CONFIG) {
  const { windowMs, maxRequests } = config;

  return function rateLimit(
    req: Request,
    next: (req: Request) => Promise<Response>,
  ): Promise<Response> {
    const url = new URL(req.url);
    const token = url.pathname.split('/')[3]; // Extract token from /api/public/:token/...
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const key = `${ip}:${token}`;

    const now = Date.now();
    const record = rateLimitState[key];

    // Check if we have an existing record and if it's still within the window
    if (record && record.resetTime > now) {
      record.count++;

      if (record.count > maxRequests) {
        return Promise.resolve(
          new Response(
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
                'X-RateLimit-Limit': String(maxRequests),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(record.resetTime),
                'Retry-After': String(Math.ceil((record.resetTime - now) / 1000)),
              },
            },
          ),
        );
      }
    } else {
      // Create new record for the new window
      rateLimitState[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
    }

    return next(req);
  };
}

// Export cleanup function for testing or graceful shutdown
export function clearRateLimitState(): void {
  Object.keys(rateLimitState).forEach((key) => {
    delete rateLimitState[key];
  });
}

// Get current rate limit status for a key (for testing/debugging)
export function getRateLimitStatus(key: string): RateLimitRecord | undefined {
  const record = rateLimitState[key];
  if (!record) {
    return undefined;
  }

  const now = Date.now();
  if (now > record.resetTime) {
    return undefined;
  }

  return record;
}
