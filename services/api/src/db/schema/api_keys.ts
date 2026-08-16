import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

// ─── API Keys ───────────────────────────────────────────────────
export const api_keys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  prefix: varchar('prefix', { length: 20 }).notNull(),
  secret_hash: varchar('secret_hash', { length: 255 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
