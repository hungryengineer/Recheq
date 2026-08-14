import { pgTable, uuid, varchar, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';

// ─── Employer Requests ──────────────────────────────────────────
export const employerRequests = pgTable('employer_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  case_id: uuid('case_id')
    .notNull()
    .references(() => cases.id),
  token_hash: varchar('token_hash', { length: 64 }).unique(),
  employer_email: varchar('employer_email', { length: 320 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  sent_at: timestamp('sent_at', { withTimezone: true }),
  responded_at: timestamp('responded_at', { withTimezone: true }),
  response_data: jsonb('response_data'),
  reminder_count: integer('reminder_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
});
