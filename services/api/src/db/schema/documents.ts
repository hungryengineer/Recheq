import { pgTable, uuid, varchar, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';

// ─── Documents ──────────────────────────────────────────────────
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    case_id: uuid('case_id')
      .notNull()
      .references(() => cases.id),
    kind: varchar('kind', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    original_filename: varchar('original_filename', { length: 500 }).notNull(),
    mime_type: varchar('mime_type', { length: 100 }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    size_bytes: integer('size_bytes').notNull(),
    storage_path: text('storage_path').notNull(),
    uploaded_at: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('uq_documents_case_sha256').on(table.case_id, table.sha256)],
);
