import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { documents } from './documents.js';
import type { FontRunAnalysis } from '../../forensics/font-runs.js';
import type { MonetaryAnomalyAnalysis } from '../../forensics/monetary-anomalies.js';

// ─── Forensics ──────────────────────────────────────────────────
export const forensics = pgTable('forensics', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_id: uuid('document_id')
    .notNull()
    .unique()
    .references(() => documents.id),
  producer: text('producer'),
  creator: text('creator'),
  creation_date: timestamp('creation_date', { withTimezone: true }),
  modification_date: timestamp('modification_date', { withTimezone: true }),
  font_runs: jsonb('font_runs').$type<FontRunAnalysis | null>(),
  monetary_anomalies: jsonb('monetary_anomalies').$type<MonetaryAnomalyAnalysis | null>(),
  metadata_raw: jsonb('metadata_raw'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});
