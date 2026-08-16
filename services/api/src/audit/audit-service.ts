import type { EventRecord, EventInput } from '@tieout/schema';
import { calculateEventHash } from './hash-chain.js';
import crypto from 'node:crypto';

export interface IAuditRepository {
  /**
   * Fetches the most recent event for a given case, ordered by seq DESC.
   * Returns null if no events exist yet.
   *
   * @param tx - Optional transaction handle. When provided the read runs inside
   *   the same transaction as the subsequent appendEvent call. This keeps the
   *   read/write snapshot consistent; it does not by itself serialize concurrent
   *   appends for the same case_id.
   */
  getLastEvent(caseId: string, tx?: unknown): Promise<EventRecord | null>;

  /**
   * Appends the new event transactionally.
   * tx represents the database transaction to ensure atomicity with other state updates.
   */
  appendEvent(tx: unknown, event: EventRecord): Promise<void>;

  /**
   * Retrieves all events for a case, ordered by seq ASC.
   */
  getEvents(caseId: string): Promise<EventRecord[]>;
}

export class AuditService {
  constructor(private readonly repo: IAuditRepository) {}

  /**
   * Transactionally appends a new audit event, automatically calculating the
   * monotonic sequence and the cryptographically secure hash chain.
   *
   * Both the getLastEvent read and the appendEvent write use the same `tx` so
   * they execute on the same connection and within the same snapshot. Note that
   * this gives atomicity, NOT serialization: two concurrent transactions still
   * read the same last event and can compute the same seq. Callers that need to
   * serialize concurrent appends for a case (e.g. the consent flow) must lock
   * the case row FOR UPDATE before calling this. For callers that cannot hold
   * such a lock, this method retries a bounded number of times when the
   * uq_events_case_seq unique constraint rejects the insert (SQLSTATE 23505).
   */
  async appendEvent(tx: unknown, input: EventInput): Promise<EventRecord> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.appendEventOnce(tx, input);
      } catch (cause) {
        const isUniqueViolation =
          typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
        if (!isUniqueViolation || attempt === maxAttempts) {
          throw cause;
        }
        // Concurrent caller committed a higher seq; re-read and retry.
      }
    }
    throw new Error('appendEvent: unreachable');
  }

  private async appendEventOnce(tx: unknown, input: EventInput): Promise<EventRecord> {
    // Thread tx into getLastEvent so the read is visible to and consistent with
    // the transaction that will own the insert.
    const lastEvent = await this.repo.getLastEvent(input.case_id, tx);

    const seq = lastEvent ? lastEvent.seq + 1 : 1;
    const prevHash = lastEvent ? lastEvent.hash : null;

    const newHash = calculateEventHash(prevHash, seq, input.kind, input.payload);

    const record: EventRecord = {
      id: crypto.randomUUID(),
      case_id: input.case_id,
      seq,
      kind: input.kind,
      payload: input.payload,
      hash: newHash,
      prev_hash: prevHash,
      actor: input.actor,
      created_at: new Date().toISOString(),
    };

    await this.repo.appendEvent(tx, record);
    return record;
  }
}
