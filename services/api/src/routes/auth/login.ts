import { LoginInputSchema, type LoginResponse } from '@recheq/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../../http/errors.js';
import type { Database } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { signToken } from '../../security/jwt.js';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

// ─── RCQ-117: Login hardening ───────────────────────────────────
//
// R6.1: Always perform bcrypt comparison, even when no user matches,
//        using a fixed dummy hash to eliminate the timing oracle.
// R6.2: Per-email rate limiting: 5 attempts per 15 minutes.
// R6.3: Per-IP rate limiting: 20 attempts per 15 minutes.
// R6.4: Log failed attempts with hashed email and source IP.
//        Never log the submitted password.

// Pre-computed bcrypt hash of a random string — used when no user
// matches so the timing is indistinguishable from a real comparison.
// This is intentionally a valid bcrypt hash that will never match
// any real password.
const DUMMY_HASH = bcrypt.hashSync('__dummy_timing_padding__', 10);

// ─── Rate-limit state ───────────────────────────────────────────
// Durable Postgres-backed limiter shared across instances. Login is the one
// route we always gate; public token routes are gated in toPublicHandler.
import type { RateLimitStore, RateLimitResult } from '../../security/rate-limit.js';
import {
  createSqlRateLimitStore,
  createRateLimitCounterRepo,
} from '../../security/sql-rate-limit-store.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_MAX_ATTEMPTS = 5;
const IP_MAX_ATTEMPTS = 20;

/**
 * In-memory rolling-window limiter used only when no DB-backed store is
 * available (unit tests with { repo } deps). Production uses the SQL store.
 */
class RollingRateLimiter implements RateLimitStore {
  private store = new Map<string, number[]>();
  private readonly maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  async increment({
    scope,
    key,
    windowMs,
    maxRequests,
  }: {
    scope: string;
    key: string;
    windowMs: number;
    maxRequests: number;
  }): Promise<RateLimitResult> {
    const now = Date.now();
    const mapKey = `${scope}:${key}`;
    let attempts = this.store.get(mapKey) || [];

    attempts = attempts.filter((timestamp) => now - timestamp < windowMs);

    if (attempts.length >= maxRequests) {
      this.store.set(mapKey, attempts);
      const oldest = attempts[0]!;
      const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      return {
        allowed: false,
        count: attempts.length,
        limit: maxRequests,
        resetAt: oldest + windowMs,
        retryAfterSeconds,
      };
    }

    attempts.push(now);

    if (this.store.size >= this.maxEntries && !this.store.has(mapKey)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }

    this.store.set(mapKey, attempts);
    return { allowed: true, count: attempts.length, limit: maxRequests, resetAt: now + windowMs };
  }

  clear(): void {
    this.store.clear();
  }
}

const _testEmailLimits = new RollingRateLimiter();
const _testIpLimits = new RollingRateLimiter();

export function _clearLoginRateLimitsForTest() {
  _testEmailLimits.clear();
  _testIpLimits.clear();
}

function buildLoginLimiters(deps: { db: Database } | { repo: LoginRepository }): {
  email: RateLimitStore;
  ip: RateLimitStore;
} {
  if ('db' in deps) {
    const sqlStore = () => createSqlRateLimitStore(createRateLimitCounterRepo(deps.db));
    return { email: sqlStore(), ip: sqlStore() };
  }
  return { email: _testEmailLimits, ip: _testIpLimits };
}

/** Hash the email for logging — never log the raw email on failed attempts */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

import { toErrorResponse } from '../../http/errors.js';

export interface LoginRepository {
  getUserByEmail(email: string): Promise<{
    id: string;
    name: string | null;
    email: string;
    password_hash: string | null;
    org_id: string;
    role: string;
  } | null>;
}

export async function loginHandler(
  req: { body: unknown; ip?: string },
  deps: { repo: LoginRepository } | { db: Database },
): Promise<{
  status: number;
  body: LoginResponse | { error: { code: string; message: string } };
  headers?: Record<string, string>;
}> {
  try {
    const parseResult = LoginInputSchema.safeParse(req.body);

    if (!parseResult.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid credentials');
    }

    const { email, password } = parseResult.data;

    // R6.3 Require a valid IP
    if (!req.ip) {
      throw new AppError(400, 'BAD_REQUEST', 'Client IP is required');
    }
    const ip = req.ip;

    // R6.2: Per-email rate limit
    const emailKey = email.toLowerCase().trim();
    const limiters = buildLoginLimiters(deps);
    const emailCheck = await limiters.email.increment({
      scope: 'login_email',
      key: emailKey,
      windowMs: WINDOW_MS,
      maxRequests: EMAIL_MAX_ATTEMPTS,
    });
    if (!emailCheck.allowed) {
      // R6.4: Log with hashed email, never log password
      console.warn(`Rate limit exceeded for email=${hashEmail(email)} ip=${ip}`);
      return {
        status: 429,
        body: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many login attempts. Please try again later.',
          },
        },
        headers: { 'Retry-After': String(emailCheck.retryAfterSeconds) },
      };
    }

    // R6.3: Per-IP rate limit
    const ipCheck = await limiters.ip.increment({
      scope: 'login_ip',
      key: ip,
      windowMs: WINDOW_MS,
      maxRequests: IP_MAX_ATTEMPTS,
    });
    if (!ipCheck.allowed) {
      console.warn(`Rate limit exceeded for ip=${ip}`);
      return {
        status: 429,
        body: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many login attempts. Please try again later.',
          },
        },
        headers: { 'Retry-After': String(ipCheck.retryAfterSeconds) },
      };
    }

    const fetchUser =
      'repo' in deps
        ? (emailStr: string) => deps.repo.getUserByEmail(emailStr)
        : async (emailStr: string) => {
            const [u] = await deps.db
              .select()
              .from(schema.users)
              .where(eq(schema.users.email, emailStr));
            return u || null;
          };

    // Find user by email
    const user = await fetchUser(email);

    // R6.1: Always perform bcrypt comparison to eliminate timing oracle.
    // If no user exists, compare against the dummy hash so the timing
    // is indistinguishable from a real comparison.
    const hashToCompare = user?.password_hash || DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.password_hash || !isMatch) {
      // R6.4: Log failed attempt with hashed email + IP, never the password
      console.warn(`Failed login attempt email=${hashEmail(email)} ip=${ip}`);
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    // Sign JWT
    const token = await signToken({
      userId: user.id,
      orgId: user.org_id,
      role: user.role,
    });

    return {
      status: 200,
      body: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        },
      },
    };
  } catch (error) {
    const errorResponse = toErrorResponse(error);
    return {
      status: errorResponse.status,
      body: errorResponse.body,
    };
  }
}
