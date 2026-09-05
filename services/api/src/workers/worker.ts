import type PgBoss from 'pg-boss';
import { initPgBoss, getPgBoss } from '../workflows/pgboss.js';
import { createDb, type Database } from '../db/client.js';

export interface JobContext {
  case_id: string;
  org_id: string;
  user_id: string;
  [key: string]: unknown;
}

// Case processing now runs off the request path in the 'case_processing' queue.

import { processEmployerWorkflowJob } from '../workflows/employer-reminders.js';
import { processEmailDelivery } from '../workflows/email-worker.js';
import type { CaseProcessingDeps } from '../workflows/case-processing.js';
import type { ProcessCaseJob } from '../workflows/job-types.js';
import { CaseProcessingWorker } from './case-processing-worker.js';
import { deliverWebhook, type WebhookDeliveryJob } from '../workflows/webhook-worker.js';

let caseWorker: CaseProcessingWorker | null = null;
async function processCaseJob(jobsParam: PgBoss.Job | PgBoss.Job[]): Promise<void> {
  if (!caseWorker) {
    throw new Error('Case worker dependencies not initialized, cannot process case job');
  }
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  for (const job of jobs) {
    await caseWorker.handleJob(job.data as unknown as ProcessCaseJob);
  }
}

async function processEmployerJob(jobsParam: PgBoss.Job | PgBoss.Job[]): Promise<void> {
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  await processEmployerWorkflowJob(jobs);
}
import { lt, and, ne, eq } from 'drizzle-orm';
import { schema } from '../db/client.js';
import { createDocumentStorageFromEnv } from '../storage/document-storage.js';

export async function retentionJob(jobsParam: PgBoss.Job | PgBoss.Job[]): Promise<void> {
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  if (process.env.RETENTION_PURGE_ENABLED !== 'true') {
    for (const job of jobs) console.log('retention purge disabled via config', { id: job.id });
    return;
  }
  
  if (!caseWorker) {
    throw new Error('Case worker dependencies not initialized, cannot process retention job');
  }

  const db = getWebhookDb();
  const storage = createDocumentStorageFromEnv(process.env);
  
  const thresholdDays = parseInt(process.env.RETENTION_THRESHOLD_DAYS || '180', 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

  const oldCases = await db
    .select({ id: schema.cases.id, org_id: schema.cases.org_id })
    .from(schema.cases)
    .where(
      and(
        lt(schema.cases.created_at, cutoffDate),
        ne(schema.cases.candidate_name, '[REDACTED]')
      )
    );
    
  for (const c of oldCases) {
    console.log(`Purging retention PII for case ${c.id}`);
    
    // Delete documents from storage
    const docs = await db
      .select({ id: schema.documents.id, storage_path: schema.documents.storage_path })
      .from(schema.documents)
      .where(eq(schema.documents.case_id, c.id));
      
    for (const d of docs) {
      if (d.storage_path) {
        try {
          await storage.deleteObject(d.storage_path);
        } catch (e) {
          console.error(`Failed to delete storage object ${d.storage_path}`, e);
        }
      }
    }
    
    // Nullify PII in DB
    await db.update(schema.cases)
      .set({
         candidate_name: '[REDACTED]',
         candidate_email: '[REDACTED]',
         employer_name: '[REDACTED]',
         title: '[REDACTED]',
         uan: null
      })
      .where(eq(schema.cases.id, c.id));
      
    // Acknowledge jobs (if we have multiple jobs, we log it)
  }
  for (const job of jobs) console.log('retention cleanup complete', { id: job.id, casesPurged: oldCases.length });
}

// Webhook delivery runs against a raw Postgres connection (not the web app's
// repository object) so the drizzle query builders in webhook-worker work.
let webhookDb: Database | null = null;
function getWebhookDb(): Database {
  if (!webhookDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set for webhook delivery worker');
    webhookDb = createDb(url);
  }
  return webhookDb;
}
async function webhookJob(jobsParam: PgBoss.Job | PgBoss.Job[]): Promise<void> {
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  await deliverWebhook(jobs as unknown as PgBoss.Job<WebhookDeliveryJob>[], { db: getWebhookDb() });
}

export async function startWorkers(deps?: CaseProcessingDeps): Promise<void> {
  if (deps) {
    caseWorker = new CaseProcessingWorker(deps);
  }
  try {
    const boss = await initPgBoss();

    const startQueue = <T extends object>(
      queue: string,
      concurrency: number,
      handler: (jobs: PgBoss.Job<T>[]) => Promise<void>,
    ) =>
      Promise.all(
        Array.from({ length: Math.max(1, concurrency) }).map(() => boss.work(queue, handler)),
      );

    await Promise.all([
      startQueue('case_processing', 2, processCaseJob),
      startQueue('employer_workflow', 2, processEmployerJob),
      startQueue('retention_cleanup', 1, retentionJob),
      startQueue('webhook_delivery', 3, webhookJob),
      startQueue('email_delivery', 2, processEmailDelivery),
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
