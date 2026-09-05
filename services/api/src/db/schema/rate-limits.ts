import { pgTable, uuid, varchar, timestamp, integer, unique } from 'drizzle-orm/pg-core';

// ─── Durable Rate Limiting ──────────────────────────────────────
// Postgres-backed fixed-window counters. Survives restarts and is shared
// across serverless instances (unlike the previous in-memory store).
// One row per (scope, key); counts are incremented atomically with a single
// INSERT ... ON CONFLICT (scope, key) DO UPDATE so window resets and counts
// are always consistent, even on multi-instance serverless.
export const rate_limits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: varchar('scope', { length: 50 }).notNull(),
    key: varchar('key', { length: 500 }).notNull(),
    window_start: timestamp('window_start', { withTimezone: true }).notNull(),
    window_end: timestamp('window_end', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    max_requests: integer('max_requests').notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('uq_rate_limits_scope_key').on(table.scope, table.key)],
);
