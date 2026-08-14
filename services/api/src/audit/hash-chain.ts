import crypto from 'node:crypto';
import type { EventKind } from '@tieout/schema';
import { toCanonicalJson } from './canonical-json.js';

/**
 * Calculates the SHA-256 hash for an audit event.
 * Hash calculation follows: prev_hash|seq|kind|canonical_json(payload)
 * If this is the first event, prevHash is an empty string.
 */
export function calculateEventHash(
  prevHash: string | null,
  seq: number,
  kind: EventKind,
  payload: unknown,
): string {
  const normalizedPrevHash = prevHash ?? '';
  const canonicalPayload = toCanonicalJson(payload);

  // Format: prev_hash|seq|kind|canonical_json(payload)
  const dataToHash = `${normalizedPrevHash}|${seq}|${kind}|${canonicalPayload}`;

  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}
