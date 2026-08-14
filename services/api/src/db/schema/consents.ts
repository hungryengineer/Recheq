import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';

// ─── Consents ───────────────────────────────────────────────────
export const consents = pgTable('consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  case_id: uuid('case_id')
    .notNull()
    .references(() => cases.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  consent_text: text('consent_text').notNull(),
  consent_version: varchar('consent_version', { length: 50 }).notNull(),
  granted_at: timestamp('granted_at', { withTimezone: true }),
  ip_address: varchar('ip_address', { length: 45 }),
  user_agent: text('user_agent'),
  withdrawn_at: timestamp('withdrawn_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  token_hash: varchar('token_hash', { length: 64 }).unique(),
});
