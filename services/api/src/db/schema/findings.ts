import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';

// ─── Findings ───────────────────────────────────────────────────
export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  case_id: uuid('case_id')
    .notNull()
    .references(() => cases.id),
  rule_id: varchar('rule_id', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  title: varchar('title', { length: 500 }).notNull(),
  explanation: text('explanation').notNull(),
  expected: text('expected'),
  observed: text('observed'),
  source_document_ids: uuid('source_document_ids').array(),
  dispute_reason: text('dispute_reason'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
