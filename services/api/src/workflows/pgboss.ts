import PgBoss from 'pg-boss';
import { getDbConnection } from '../db/client.js';
import { logger } from '../observability/logger.js';

export interface JobConfig {
  retryLimit: number;
  retryDelay: number;
  expireInSeconds: number;
}

const JOB_CONFIGS: Record<string, JobConfig> = {
  CASE_PROCESSING: {
    retryLimit: 3,
    retryDelay: 30,
    expireInSeconds: 86400, // 24h
  },
  EMPLOYER_WORKFLOW: {
    retryLimit: 2,
    retryDelay: 60,
    expireInSeconds: 604800, // 7 days
  },
  RETENTION_CLEANUP: {
    retryLimit: 1,
    retryDelay: 300,
    expireInSeconds: 2592000, // 30 days
  },
  WEBHOOK_DELIVERY: {
    retryLimit: 5,
    retryDelay: 15,
    expireInSeconds: 3600, // 1h
  },
};

let boss: PgBoss | null = null;

export async function initPgBoss(): Promise<PgBoss> {
  if (boss) return boss;

  const dbConn = await getDbConnection();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  boss = new PgBoss(connectionString);

  boss.on('error', (error) => {
    logger.error('pg-boss error', { error: error.message });
  });

  await boss.start();
  logger.info('pg-boss initialized');

  // Create queues
  await Promise.all([
    boss.createQueue('case_processing'),
    boss.createQueue('employer_workflow'),
    boss.createQueue('retention_cleanup'),
    boss.createQueue('webhook_delivery'),
  ]);

  return boss;
}

export async function getPgBoss(): Promise<PgBoss> {
  if (!boss) {
    throw new Error('pg-boss not initialized');
  }
  return boss;
}

export async function publishJob(
  queue: keyof typeof JOB_CONFIGS,
  data: Record<string, unknown>,
  options?: { delaySeconds?: number; singletonKey?: string },
): Promise<string> {
  const pgBoss = await getPgBoss();
  const config = JOB_CONFIGS[queue];

  const jobId = await pgBoss.publish(queue, data, {
    retryLimit: config.retryLimit,
    retryDelay: config.retryDelay,
    expireInSeconds: config.expireInSeconds,
    singletonKey: options?.singletonKey,
    startAfter: options?.delaySeconds ? new Date(Date.now() + options.delaySeconds * 1000) : undefined,
  });

  logger.info('job published', { queue, jobId, caseId: data.case_id });
  return jobId;
}

export async function closePgBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    logger.info('pg-boss stopped');
  }
}
