import type { EventRecord } from '@recheq/schema';
import { calculateEventHash } from './hash-chain.js';

export class ChainVerificationError extends Error {
  constructor(
    message: string,
    public readonly eventId: string,
  ) {
    super(message);
    this.name = 'ChainVerificationError';
  }
}

/**
 * Verifies the integrity of an audit event chain.
 * Expects events to be ordered by sequence ASC.
 * Throws ChainVerificationError if tampering is detected.
 */
export function verifyChain(events: EventRecord[]): void {
  if (events.length === 0) return;

  let expectedPrevHash: string | null = null;
  let expectedSeq = 1;

  for (const event of events) {
    if (event.seq !== expectedSeq) {
      throw new ChainVerificationError(
        `Sequence mismatch: expected ${expectedSeq}, got ${event.seq}`,
        event.id,
      );
    }

    if (event.prev_hash !== expectedPrevHash) {
      throw new ChainVerificationError(
        `prev_hash mismatch: expected ${expectedPrevHash}, got ${event.prev_hash}`,
        event.id,
      );
    }

    const calculatedHash: string = calculateEventHash(
      event.prev_hash,
      event.seq,
      event.kind,
      event.payload,
    );

    if (calculatedHash !== event.hash) {
      throw new ChainVerificationError(
        `Hash mismatch: Payload or metadata was tampered with`,
        event.id,
      );
    }

    expectedPrevHash = event.hash;
    expectedSeq++;
  }
}
