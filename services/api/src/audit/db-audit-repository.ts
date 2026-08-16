import { eq, desc } from 'drizzle-orm';
import type { EventRecord } from '@tieout/schema';
import { events } from '../db/schema/events.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { IAuditRepository } from './audit-service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = PostgresJsDatabase<any>;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

/** Type guard: true when the value looks like a Drizzle transaction handle. */
function isTx(value: unknown): value is Tx {
  return (
    typeof value === 'object' &&
    value !== null &&
    'insert' in value &&
    'select' in value &&
    'update' in value &&
    'delete' in value
  );
}

export class DbAuditRepository implements IAuditRepository {
  constructor(private readonly db: DB) {}

  async getLastEvent(caseId: string): Promise<EventRecord | null> {
    const records = await this.db
      .select()
      .from(events)
      .where(eq(events.case_id, caseId))
      .orderBy(desc(events.seq))
      .limit(1);

    return records[0] ? (records[0] as unknown as EventRecord) : null;
  }

  async appendEvent(tx: unknown, event: EventRecord): Promise<void> {
    const target: DB = isTx(tx) ? (tx as unknown as DB) : this.db;
    await target.insert(events).values({
      id: event.id,
      case_id: event.case_id,
      seq: event.seq,
      kind: event.kind,
      payload: event.payload as never,
      hash: event.hash,
      prev_hash: event.prev_hash,
      actor: event.actor,
      created_at: new Date(event.created_at),
    });
  }

  async getEvents(caseId: string): Promise<EventRecord[]> {
    const records = await this.db
      .select()
      .from(events)
      .where(eq(events.case_id, caseId))
      .orderBy(events.seq);

    return records as unknown as EventRecord[];
  }
}
