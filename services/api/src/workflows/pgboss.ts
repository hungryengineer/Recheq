import PgBoss from 'pg-boss';
import * as dotenv from 'dotenv';
import path from 'path';

// Forcefully inject .env.local because Next.js Turbopack sometimes isolates
// instrumentation.ts workers from the main Next.js environment cache.
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });

export interface JobConfig {
  retryLimit: number;
  retryDelay: number;
  expireInSeconds: number;
}

const JOB_CONFIGS: Record<string, JobConfig> = {
  CASE_PROCESSING: {
    retryLimit: 3,
    retryDelay: 30,
    expireInSeconds: 3600, // 1h
  },
  EMAIL_DELIVERY: {
    retryLimit: 5,
    retryDelay: 60, // 1m
    expireInSeconds: 3600, // 1h
  },
  EMPLOYER_WORKFLOW: {
    retryLimit: 2,
    retryDelay: 60,
    expireInSeconds: 43200, // 12h
  },
  RETENTION_CLEANUP: {
    retryLimit: 1,
    retryDelay: 300,
    expireInSeconds: 43200, // 12h
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

  // Attempt to load .env.local from the web workspace root just in case
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  boss = new PgBoss(connectionString);

  boss.on('error', (error) => {
    console.error('pg-boss error', { error: error.message });
  });

  try {
    await boss.start();
    console.log('pg-boss initialized');
  } catch (error) {
    console.error('failed to initialize pg-boss', { error: (error as Error).message });
    throw error;
  }

  try {
    // Run sequentially to minimize deadlock chances in Neon Serverless/HMR
    await boss.createQueue('employer_workflow');
    await boss.createQueue('retention_cleanup');
    await boss.createQueue('webhook_delivery');
    await boss.createQueue('email_delivery');
  } catch (error: unknown) {
    // Ignore PostgreSQL deadlock errors (40P01) or duplicate table errors that happen
    // when Next.js HMR concurrently boots multiple instrumentation routines.
    const err = error as { code?: string };
    if (err.code !== '40P01' && err.code !== '42P07') {
      console.warn('Non-fatal error creating pg-boss queues:', error);
    }
  }

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
  // SECURITY: Prevent large blobs/PII from being persisted in the plaintext pg-boss queue
  const forbiddenKeys = new Set([
    'documentContent',
    'rawBase64',
    'content',
    'pdf_data',
    'extractedData',
  ]);

  function checkPii(obj: unknown): void {
    if (Array.isArray(obj)) {
      obj.forEach(checkPii);
    } else if (obj !== null && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (forbiddenKeys.has(key)) {
          throw new Error(
            `SECURITY: Do not pass '${key}' into publishJob payload. Pass the ID and load it inside the worker.`,
          );
        }
        checkPii(value);
      }
    }
  }

  checkPii(data);

  const pgBoss = await initPgBoss();
  const config = JOB_CONFIGS[queue] || { retryLimit: 3, retryDelay: 60, expireInSeconds: 300 };

  const publishOptions: PgBoss.SendOptions = {
    retryLimit: config.retryLimit,
    retryDelay: config.retryDelay,
    expireInSeconds: config.expireInSeconds,
  };

  if (options?.singletonKey) {
    publishOptions.singletonKey = options.singletonKey;
  }
  if (options?.delaySeconds) {
    publishOptions.startAfter = options.delaySeconds;
  }

  const targetQueue = queue.toLowerCase();
  const jobId = await pgBoss.send(targetQueue, data as object, publishOptions);
  console.log('job published', { queue: targetQueue, jobId, caseId: data.case_id });
  return String(jobId || '');
}

export async function closePgBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    console.log('pg-boss stopped');
  }
}
