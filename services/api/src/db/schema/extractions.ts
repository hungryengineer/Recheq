import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { documents } from './documents.js';

// ─── Extractions ────────────────────────────────────────────────
export const extractions = pgTable('extractions', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_id: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  model_id: varchar('model_id', { length: 100 }),
  schema_version: varchar('schema_version', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  extracted_data: jsonb('extracted_data'),
  token_usage: jsonb('token_usage'),
  error_message: text('error_message'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});
