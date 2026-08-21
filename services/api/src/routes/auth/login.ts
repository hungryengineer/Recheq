import { LoginInputSchema, type LoginResponse } from '@tieout/schema';
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
// Rolling window rate limiter. For production, use Redis.
class RollingRateLimiter {
  private store = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxEntries: number;

  constructor(windowMs: number, maxEntries = 10000) {
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  check(key: string, maxAttempts: number): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    let attempts = this.store.get(key) || [];
    
    // Remove expired attempts
    attempts = attempts.filter((timestamp) => now - timestamp < this.windowMs);
    
    if (attempts.length >= maxAttempts) {
      this.store.set(key, attempts);
      const oldest = attempts[0]!;
      const retryAfterSeconds = Math.ceil((oldest + this.windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    attempts.push(now);
    
    // Evict old entries if Map gets too large (bounding)
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    
    this.store.set(key, attempts);
    return { allowed: true };
  }
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const emailLimits = new RollingRateLimiter(WINDOW_MS, 10000);
const ipLimits = new RollingRateLimiter(WINDOW_MS, 10000);

const EMAIL_MAX_ATTEMPTS = 5;
const IP_MAX_ATTEMPTS = 20;

/** Hash the email for logging — never log the raw email on failed attempts */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

import { toErrorResponse } from '../../http/errors.js';

export async function loginHandler(
  req: { body: unknown; ip?: string },
  deps: { db: Database },
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
    const emailCheck = emailLimits.check(emailKey, EMAIL_MAX_ATTEMPTS);
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
    const ipCheck = ipLimits.check(ip, IP_MAX_ATTEMPTS);
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

    // Find user by email
    const [user] = await deps.db.select().from(schema.users).where(eq(schema.users.email, email));

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
          name: user.name,
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
