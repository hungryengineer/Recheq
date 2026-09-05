import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { RateLimitResult, RateLimitStore } from './rate-limit.js';

// ─── Postgres-backed rate limit store ───────────────────────────
// A single atomic INSERT ... ON CONFLICT (scope, key) DO UPDATE keeps the
// window reset and counter increment consistent across serverless instances.
// Fixed-window semantics: once window_end passes, the count resets to 1.

export interface RateLimitCounterRow {
  count: number;
  max_requests: number;
  window_end: Date | string;
}

export interface RateLimitCounterRepo {
  incrementWindow(args: {
    scope: string;
    key: string;
    windowMs: number;
    maxRequests: number;
  }): Promise<RateLimitCounterRow>;
}

export function createRateLimitCounterRepo(db: Database): RateLimitCounterRepo {
  return {
    async incrementWindow({ scope, key, windowMs, maxRequests }) {
      const windowSeconds = windowMs / 1000;
      const rows = (await db.execute(sql`
        INSERT INTO rate_limits (scope, key, window_start, window_end, count, max_requests)
        VALUES (${scope}, ${key}, now(), now() + make_interval(secs => ${windowSeconds}), 1, ${maxRequests})
        ON CONFLICT (scope, key) DO UPDATE
        SET count = CASE
              WHEN rate_limits.window_end <= now() THEN 1
              ELSE rate_limits.count + 1
            END,
            window_start = CASE
              WHEN rate_limits.window_end <= now() THEN now()
              ELSE rate_limits.window_start
            END,
            window_end = CASE
              WHEN rate_limits.window_end <= now() THEN now() + make_interval(secs => ${windowSeconds})
              ELSE rate_limits.window_end
            END,
            max_requests = EXCLUDED.max_requests,
            updated_at = now()
        RETURNING count, max_requests, window_end
      `)) as unknown as RateLimitCounterRow[];

      const row = Array.isArray(rows) ? rows[0] : undefined;
      if (!row) {
        throw new Error('Rate limit counter returned no row');
      }
      return {
        count: Number(row.count),
        max_requests: Number(row.max_requests),
        window_end: row.window_end,
      };
    },
  };
}

export function createSqlRateLimitStore(repo: RateLimitCounterRepo): RateLimitStore {
  return {
    async increment({ scope, key, windowMs, maxRequests }) {
      const row = await repo.incrementWindow({ scope, key, windowMs, maxRequests });
      const resetAt = new Date(row.window_end).getTime();
      const now = Date.now();

      const result: RateLimitResult = {
        allowed: row.count <= row.max_requests,
        count: row.count,
        limit: row.max_requests,
        resetAt,
      };

      if (!result.allowed) {
        result.retryAfterSeconds = Math.ceil((resetAt - now) / 1000);
      }

      return result;
    },
  };
}
