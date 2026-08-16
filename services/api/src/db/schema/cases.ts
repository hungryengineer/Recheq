import {
  pgTable,
  uuid,
  varchar,
  numeric,
  date,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';

// ─── Cases ──────────────────────────────────────────────────────
export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    employer_name: varchar('employer_name', { length: 500 }).notNull(),
    candidate_name: varchar('candidate_name', { length: 500 }).notNull(),
    candidate_email: varchar('candidate_email', { length: 255 }).notNull(),
    title: varchar('title', { length: 1000 }).notNull(),
    claimed_ctc: numeric('claimed_ctc', { precision: 15, scale: 2 }).notNull(),
    employment_start: date('employment_start').notNull(),
    employment_end: date('employment_end').notNull(),
    uan: varchar('uan', { length: 20 }),
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    verdict: varchar('verdict', { length: 30 }),
    risk_score: integer('risk_score'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_cases_org_id').on(table.org_id)],
);
