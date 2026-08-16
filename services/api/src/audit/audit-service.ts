import type { EventRecord, EventInput } from '@tieout/schema';
import { calculateEventHash } from './hash-chain.js';
import crypto from 'node:crypto';

export interface IAuditRepository {
  /**
   * Fetches the most recent event for a given case, ordered by seq DESC.
   * Returns null if no events exist yet.
   *
   * @param tx - Optional transaction handle. When provided the read runs inside
   *   the same transaction as the subsequent appendEvent call, preventing a
   *   seq-race between concurrent appends for the same case_id.
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
   * they execute on the same connection and within the same snapshot, preventing
   * the seq-race that arises when two concurrent callers read the same last event
   * and then both try to insert with the same seq value.
   */
  async appendEvent(tx: unknown, input: EventInput): Promise<EventRecord> {
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
