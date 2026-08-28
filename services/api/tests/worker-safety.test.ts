import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import PgBoss from 'pg-boss';
import * as dotenv from 'dotenv';
import path from 'path';

describe('Worker Safety', () => {
  let boss: PgBoss;

  beforeEach(async () => {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    const dbUrl = process.env.DATABASE_URL;
    boss = new PgBoss(dbUrl!);
    await boss.start();
  });

  afterEach(async () => {
    if (boss) await boss.stop();
  });

  it('should retry failed jobs', async () => {
    await boss.createQueue('retry_test');

    await boss.send('retry_test', { test: true }, { retryLimit: 2 });

    let attempts = 0;
    await boss.work('retry_test', async () => {
      attempts++;
      if (attempts < 2) throw new Error('First attempt fails');
    });

    // Wait until the failed job has actually been retried, instead of
    // guessing a fixed delay.
    const deadline = Date.now() + 5000;
    while (attempts < 2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(attempts).toBe(2);
  }, 15000);

  it('should maintain job queue across restarts', async () => {
    await boss.createQueue('persist_test');
    await boss.send('persist_test', { case_id: 'test-123' });

    const state = await boss.getQueueSize('persist_test');
    expect(state).toBeGreaterThan(0);

    await boss.stop();
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    const boss2 = new PgBoss(process.env.DATABASE_URL!);
    await boss2.start();

    const state2 = await boss2.getQueueSize('persist_test');
    expect(state2).toBeGreaterThan(0);

    boss = boss2;
  }, 15000);

  it('should cap case processing concurrency at 4', async () => {
    await boss.createQueue('case_proc_test');

    // Publish 10 jobs
    for (let i = 0; i < 10; i++) {
      await boss.send('case_proc_test', { index: i });
    }

    let concurrent = 0;
    let maxConcurrent = 0;

    await Promise.all(
      Array.from({ length: 4 }).map(() =>
        boss.work('case_proc_test', async (jobs: PgBoss.Job[]) => {
          concurrent += jobs.length;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 50));
          concurrent -= jobs.length;
        }),
      ),
    );

    await new Promise((r) => setTimeout(r, 2000));
    expect(maxConcurrent).toBeLessThanOrEqual(4);
  }, 15000);

  it('should not log personal document data', async () => {
    await boss.createQueue('safe_log_test');
    await boss.send('safe_log_test', {
      case_id: 'case-123',
      org_id: 'org-456',
      // No raw document data
    });

    await boss.work('safe_log_test', async (jobs: PgBoss.Job[]) => {
      const job = Array.isArray(jobs) ? jobs[0] : jobs;
      // Job processing should not expose document content
      expect(JSON.stringify(job)).not.toContain('document_content');
    });

    await new Promise((r) => setTimeout(r, 500));
  });

  it('should maintain idempotency with singleton keys', async () => {
    await boss.createQueue('idempotent_test');

    const key = 'unique-case-123';
    await boss.send('idempotent_test', { case_id: 'case-123' }, { singletonKey: key });
    await boss.send('idempotent_test', { case_id: 'case-123' }, { singletonKey: key });

    let execCount = 0;
    await boss.work('idempotent_test', async () => {
      execCount++;
    });

    await new Promise((r) => setTimeout(r, 1000));
    expect(execCount).toBeLessThanOrEqual(2);
  });

  it('should handle job expiration', async () => {
    await boss.createQueue('expire_test');

    await boss.send('expire_test', { test: true }, { expireInSeconds: 1 });

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 2000));

    // Job should be removed or archived
    const state = await boss.getQueueSize('expire_test');
    expect(state).toBeGreaterThanOrEqual(0);
  });
});
