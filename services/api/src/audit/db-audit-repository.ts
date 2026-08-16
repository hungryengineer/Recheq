import { eq, desc } from 'drizzle-orm';
import type { EventRecord } from '@tieout/schema';
import { events } from '../db/schema/events.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { IAuditRepository } from './audit-service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = PostgresJsDatabase<any>;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

/** Union of the two query-capable handles this repository accepts. */
type Handle = DB | Tx;

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

/** Resolve the correct query handle — transaction when provided, db otherwise. */
function resolveHandle(db: DB, tx: unknown): Handle {
  return isTx(tx) ? tx : db;
}

export class DbAuditRepository implements IAuditRepository {
  constructor(private readonly db: DB) {}

  /**
   * Reads the most recent event for the case.
   *
   * When `tx` is supplied the query executes inside the same transaction as the
   * caller's subsequent insert, so both the read and the write share the same
   * database snapshot and connection. This keeps the seq computation consistent
   * with the insert; the uq_events_case_seq constraint is the final backstop
   * against a concurrent append, which AuditService handles via retry.
   */
  async getLastEvent(caseId: string, tx?: unknown): Promise<EventRecord | null> {
    const handle = resolveHandle(this.db, tx);
    const records = await handle
      .select()
      .from(events)
      .where(eq(events.case_id, caseId))
      .orderBy(desc(events.seq))
      .limit(1);

    return records[0] ? (records[0] as unknown as EventRecord) : null;
  }

  async appendEvent(tx: unknown, event: EventRecord): Promise<void> {
    const handle = resolveHandle(this.db, tx);
    await handle.insert(events).values({
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
