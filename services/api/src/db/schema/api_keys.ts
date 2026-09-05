import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

// ─── API Keys ───────────────────────────────────────────────────
// Keys use a `req_live_` prefix and bcrypt-stored secret. `last_used_at` is
// updated opportunistically (best-effort, non-blocking) on successful auth,
// enabling key rotation/audit. `prefix` is an index so lookups by the raw
// secret prefix can be narrowed before bcrypt comparison.
export const api_keys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: varchar('name', { length: 255 }).notNull(),
    prefix: varchar('prefix', { length: 20 }).notNull(),
    secret_hash: varchar('secret_hash', { length: 255 }).notNull(),
    last_used_at: timestamp('last_used_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_api_keys_prefix').on(table.prefix)],
);
