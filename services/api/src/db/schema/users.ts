import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

// ─── Users ──────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  email: varchar('email', { length: 320 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }), // Nullable for SSO users
  name: varchar('name', { length: 500 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('verifier'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
