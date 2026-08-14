import { pgTable, uuid, varchar, integer, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';

// ─── Audit Events ───────────────────────────────────────────────
// Append-only, hash-chained audit events with monotonic per-case sequence.
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    case_id: uuid('case_id')
      .notNull()
      .references(() => cases.id),
    seq: integer('seq').notNull(),
    kind: varchar('kind', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    hash: varchar('hash', { length: 64 }).notNull(),
    prev_hash: varchar('prev_hash', { length: 64 }),
    actor: varchar('actor', { length: 200 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('uq_events_case_seq').on(table.case_id, table.seq)],
);
