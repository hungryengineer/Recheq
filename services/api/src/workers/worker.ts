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

async function processCaseJob(jobs: PgBoss.Job[]): Promise<void> {
  await Promise.all(
    jobs.map(async (job) => {
      const { case_id, org_id } = job.data as unknown as JobContext;
      console.log('case processing started', { case_id, org_id });

      const db = createDb(process.env.DATABASE_URL!);
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
    }),
  );
}

async function processEmployerJob(jobs: PgBoss.Job[]): Promise<void> {
  await Promise.all(jobs.map(async (job) => console.log('employer job', { id: job.id })));
}
async function retentionJob(jobs: PgBoss.Job[]): Promise<void> {
  await Promise.all(jobs.map(async (job) => console.log('retention cleanup', { id: job.id })));
}
async function webhookJob(jobs: PgBoss.Job[]): Promise<void> {
  await Promise.all(jobs.map(async (job) => console.log('webhook delivery', { id: job.id })));
}

export async function startWorkers(): Promise<void> {
  try {
    const boss = await getPgBoss();

    await Promise.all([
      boss.work('case_processing', { batchSize: 4 }, processCaseJob),
      boss.work('employer_workflow', { batchSize: 2 }, processEmployerJob),
      boss.work('retention_cleanup', { batchSize: 1 }, retentionJob),
      boss.work('webhook_delivery', { batchSize: 3 }, webhookJob),
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
