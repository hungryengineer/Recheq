import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';

// ─── Tokens ─────────────────────────────────────────────────────
// Purpose-bound invite tokens (consent, employer). Only the SHA-256 hash of
// the raw token is stored; the raw token is sent to the candidate/employer.
export const tokens = pgTable(
  'tokens',
  {
    hash: varchar('hash', { length: 64 }).primaryKey(),
    case_id: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 20 }).notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_tokens_case_id').on(table.case_id)],
);
