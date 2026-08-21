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
// In-memory sliding window. For production, use Redis.
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const emailLimits = new Map<string, RateLimitEntry>();
const ipLimits = new Map<string, RateLimitEntry>();

const EMAIL_MAX_ATTEMPTS = 5;
const IP_MAX_ATTEMPTS = 20;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  maxAttempts: number,
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  entry.count++;

  if (entry.count > maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/** Hash the email for logging — never log the raw email on failed attempts */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

export async function loginHandler(
  req: { body: unknown; ip?: string },
  deps: { db: Database },
): Promise<{
  status: number;
  body: LoginResponse | { error: { code: string; message: string } };
  headers?: Record<string, string>;
}> {
  const parseResult = LoginInputSchema.safeParse(req.body);

  if (!parseResult.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid credentials');
  }

  const { email, password } = parseResult.data;
  const ip = req.ip || 'unknown';

  // R6.2: Per-email rate limit
  const emailKey = email.toLowerCase().trim();
  const emailCheck = checkRateLimit(emailLimits, emailKey, EMAIL_MAX_ATTEMPTS);
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
  const ipCheck = checkRateLimit(ipLimits, ip, IP_MAX_ATTEMPTS);
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
}
