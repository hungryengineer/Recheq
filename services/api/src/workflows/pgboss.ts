import PgBoss from 'pg-boss';

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

  const pgBoss = await getPgBoss();
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

  const jobId = await pgBoss.send(queue, data as object, publishOptions);
  console.log('job published', { queue, jobId, caseId: data.case_id });
  return String(jobId || '');
}

export async function closePgBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    console.log('pg-boss stopped');
  }
}
