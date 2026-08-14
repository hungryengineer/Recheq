import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';
import { consents } from './consents.js';

// ─── EPFO Records ───────────────────────────────────────────────
export const epfoRecords = pgTable('epfo_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  case_id: uuid('case_id')
    .notNull()
    .references(() => cases.id),
  uan: varchar('uan', { length: 20 }).notNull(),
  consent_id: uuid('consent_id')
    .notNull()
    .references(() => consents.id),
  employment_history: jsonb('employment_history'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  error_message: text('error_message'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});
