import { getPgBoss } from '../workflows/pgboss.js';
import { getDbConnection } from '../db/client.js';
import { logger } from '../observability/logger.js';
import { cases } from '../db/schema/cases.js';
import { eq } from 'drizzle-orm';

export interface JobContext {
  case_id: string;
  org_id: string;
  user_id: string;
  [key: string]: unknown;
}

async function processCaseJob(ctx: JobContext): Promise<void> {
  const { case_id, org_id } = ctx;
  logger.info('case processing started', { case_id, org_id });

  const db = await getDbConnection();
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
  logger.info('case processing completed', { case_id });
}

async function employerWorkflowJob(ctx: JobContext): Promise<void> {
  const { org_id } = ctx;
  logger.info('employer workflow started', { org_id });
  // Placeholder
}

async function retentionCleanupJob(): Promise<void> {
  logger.info('retention cleanup started');
  // Placeholder
}

async function webhookDeliveryJob(ctx: JobContext): Promise<void> {
  const { case_id } = ctx;
  logger.info('webhook delivery started', { case_id });
  // Placeholder
}

export async function startWorkers(): Promise<void> {
  const boss = await getPgBoss();

  // Case processing: max 4 concurrent
  await boss.subscribe('case_processing', 4, processCaseJob);

  // Employer workflow: max 2 concurrent
  await boss.subscribe('employer_workflow', 2, employerWorkflowJob);

  // Retention cleanup: single instance
  await boss.subscribe('retention_cleanup', 1, retentionCleanupJob);

  // Webhook delivery: max 3 concurrent
  await boss.subscribe('webhook_delivery', 3, webhookDeliveryJob);

  logger.info('all workers started');
}

export async function stopWorkers(): Promise<void> {
  const boss = await getPgBoss();
  await boss.unsubscribe('case_processing');
  await boss.unsubscribe('employer_workflow');
  await boss.unsubscribe('retention_cleanup');
  await boss.unsubscribe('webhook_delivery');
  logger.info('all workers stopped');
}
