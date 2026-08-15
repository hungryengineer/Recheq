import type PgBoss from 'pg-boss';
import { getPgBoss } from '../workflows/pgboss.js';
import { createDb } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { cases } from '../db/schema/cases.js';

export interface JobContext {
  case_id: string;
  org_id: string;
  user_id: string;
  [key: string]: unknown;
}

let db: ReturnType<typeof createDb>;

async function processCaseJob(jobs: PgBoss.Job[]): Promise<void> {
  for (const job of jobs) {
    const { case_id, org_id } = job.data as unknown as JobContext;
    console.log('case processing started', { case_id, org_id });

    if (!db) db = createDb(process.env.DATABASE_URL!);
    const caseRecord = await db.select().from(cases).where(eq(cases.id, case_id)).limit(1);

    if (!caseRecord.length) {
      throw new Error(`Case not found: ${case_id}`);
    }

    // Update status to processing
    await db
      .update(cases)
      .set({
        status: 'processing',
        updated_at: new Date(),
      })
      .where(eq(cases.id, case_id));

    // Placeholder for actual processing logic
    console.log('case processing completed', { case_id });
  }
}

import { processEmployerWorkflowJob } from '../workflows/employer-reminders.js';
import crypto from 'node:crypto';
import { events } from '../db/schema/events.js';
import { desc } from 'drizzle-orm';

async function processEmployerJob(jobs: PgBoss.Job[]): Promise<void> {
  if (!db) db = createDb(process.env.DATABASE_URL!);

  await processEmployerWorkflowJob(jobs, {
    audit: {
      appendEvent: async (tx: unknown, input) => {
        // Simple inline implementation for worker context
        const lastEventList = await tx
          .select()
          .from(events)
          .where(eq(events.case_id, input.case_id))
          .orderBy(desc(events.seq))
          .limit(1);

        const seq = lastEventList.length > 0 ? lastEventList[0].seq + 1 : 1;
        const prevHash = lastEventList.length > 0 ? lastEventList[0].hash : null;
        const newHash = crypto.randomBytes(32).toString('hex'); // Placeholder hash for worker

        await tx.insert(events).values({
          id: crypto.randomUUID(),
          case_id: input.case_id,
          seq,
          kind: input.kind,
          payload: input.payload,
          hash: newHash,
          prev_hash: prevHash,
          actor: input.actor,
          created_at: new Date(),
        });
      },
    },
  });
}
async function retentionJob(jobs: PgBoss.Job[]): Promise<void> {
  for (const job of jobs) console.log('retention cleanup', { id: job.id });
}
async function webhookJob(jobs: PgBoss.Job[]): Promise<void> {
  for (const job of jobs) console.log('webhook delivery', { id: job.id });
}

export async function startWorkers(): Promise<void> {
  try {
    const boss = await getPgBoss();

    const startQueue = (
      queue: string,
      concurrency: number,
      handler: (jobs: PgBoss.Job[]) => Promise<void>,
    ) =>
      Promise.all(
        Array.from({ length: Math.max(1, concurrency) }).map(() => boss.work(queue, handler)),
      );

    await Promise.all([
      startQueue('case_processing', 4, processCaseJob),
      startQueue('employer_workflow', 2, processEmployerJob),
      startQueue('retention_cleanup', 1, retentionJob),
      startQueue('webhook_delivery', 3, webhookJob),
    ]);

    console.log('workers started');
  } catch (error) {
    console.error('failed to start workers', { error: (error as Error).message });
    throw error;
  }
}

export async function stopWorkers(): Promise<void> {
  const boss = await getPgBoss();
  await boss.stop();
  console.log('all workers stopped');
}
