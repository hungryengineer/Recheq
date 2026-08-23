import type PgBoss from 'pg-boss';
import { initPgBoss, getPgBoss } from '../workflows/pgboss.js';

export interface JobContext {
  case_id: string;
  org_id: string;
  user_id: string;
  [key: string]: unknown;
}

// Case processing runs in-process from the submit route (see
// apps/web/src/lib/server/process.ts) rather than through pg-boss, per the
// platform decision. This worker only owns employer/retention/webhook jobs.

import { processEmployerWorkflowJob } from '../workflows/employer-reminders.js';
import { processEmailDelivery } from '../workflows/email-worker.js';

async function processEmployerJob(jobsParam: PgBoss.Job | PgBoss.Job[]): Promise<void> {
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  await processEmployerWorkflowJob(jobs);
}
async function retentionJob(jobsParam: PgBoss.Job | PgBoss.Job[]): Promise<void> {
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  for (const job of jobs) console.log('retention cleanup', { id: job.id });
}
async function webhookJob(jobsParam: PgBoss.Job | PgBoss.Job[]): Promise<void> {
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  for (const job of jobs) console.log('webhook delivery', { id: job.id });
}

export async function startWorkers(): Promise<void> {
  try {
    const boss = await initPgBoss();

    const startQueue = (
      queue: string,
      concurrency: number,
      handler: (jobs: PgBoss.Job[]) => Promise<void>,
    ) =>
      Promise.all(
        Array.from({ length: Math.max(1, concurrency) }).map(() => boss.work(queue, handler)),
      );

    await Promise.all([
      startQueue('employer_workflow', 2, processEmployerJob),
      startQueue('retention_cleanup', 1, retentionJob),
      startQueue('webhook_delivery', 3, webhookJob),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startQueue('email_delivery', 2, processEmailDelivery as any),
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
