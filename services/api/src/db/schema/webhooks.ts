import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

// ─── Webhook Subscriptions ──────────────────────────────────────
// A customer's registered webhook endpoint. `secret` is the raw HMAC signing
// secret shown once at creation (needed to sign deliveries; unlike passwords it
// must be recoverable by the sender). `events` is a small array of subscribed
// event names (e.g. ["case.completed"]).
export const webhook_subscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    url: varchar('url', { length: 2048 }).notNull(),
    secret: varchar('secret', { length: 255 }).notNull(),
    events: jsonb('events').notNull().$type<string[]>().default([]),
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_webhook_subscriptions_org').on(table.org_id)],
);

// ─── Webhook Delivery Log ───────────────────────────────────────
// One row per delivery attempt. `payload` is the JSON body that was (or will
// be) POSTed; `response_status` and `response_body_preview` record the result.
export const webhook_deliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscription_id: uuid('subscription_id')
      .notNull()
      .references(() => webhook_subscriptions.id),
    event: varchar('event', { length: 50 }).notNull(),
    case_id: uuid('case_id'),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    response_status: integer('response_status'),
    response_body_preview: varchar('response_body_preview', { length: 500 }),
    error_message: varchar('error_message', { length: 500 }),
    next_retry_at: timestamp('next_retry_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_webhook_deliveries_sub').on(table.subscription_id),
    index('idx_webhook_deliveries_case').on(table.case_id),
  ],
);
