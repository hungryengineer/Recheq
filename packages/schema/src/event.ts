import { z } from 'zod';
import { EventKind } from './enums.js';

// ─── Audit Event Record ─────────────────────────────────────────
// Append-only, hash-chained audit events.
export const EventRecord = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  /** Monotonic per-case sequence number */
  seq: z.number().int().min(1),
  kind: EventKind,
  /** Arbitrary event payload (must not contain sensitive data in logs) */
  payload: z.record(z.unknown()),
  /** SHA-256 hash: prev_hash|seq|kind|canonical_json(payload) */
  hash: z.string().length(64),
  /** Hash of the previous event in the chain (null for first event) */
  prev_hash: z.string().length(64).nullable(),
  /** Actor who triggered this event (user ID, system, or token purpose) */
  actor: z.string(),
  created_at: z.string().datetime(),
});
export type EventRecord = z.infer<typeof EventRecord>;

// ─── Event Input (for appending new events) ─────────────────────
export const EventInput = z.object({
  case_id: z.string().uuid(),
  kind: EventKind,
  payload: z.record(z.unknown()),
  actor: z.string(),
});
export type EventInput = z.infer<typeof EventInput>;
