import { EventRecord, EventInput } from '@tieout/schema';
import { calculateEventHash } from './hash-chain.js';
import crypto from 'node:crypto';

export interface IAuditRepository {
  /**
   * Fetches the most recent event for a given case, ordered by seq DESC.
   * Returns null if no events exist yet.
   */
  getLastEvent(caseId: string): Promise<EventRecord | null>;
  
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
   * Transactionally appends a new audit event, automatically calculating the monotonic sequence
   * and the cryptographically secure hash chain.
   */
  async appendEvent(
    tx: unknown,
    input: EventInput
  ): Promise<EventRecord> {
    const lastEvent = await this.repo.getLastEvent(input.case_id);
    
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
      created_at: new Date().toISOString()
    };
    
    await this.repo.appendEvent(tx, record);
    return record;
  }
}
