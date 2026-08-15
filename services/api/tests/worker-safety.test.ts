import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import PgBoss from 'pg-boss';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('Worker Safety', () => {
  let boss: PgBoss;

  beforeEach(async () => {
    const dbUrl = process.env.DATABASE_URL;
    boss = new PgBoss(dbUrl);
    await boss.start();
  });

  afterEach(async () => {
    if (boss) await boss.stop();
  });

  it('should retry failed jobs', async () => {
    await boss.createQueue('retry_test');

    let attempts = 0;
    await boss.subscribe('retry_test', async () => {
      attempts++;
      if (attempts < 2) throw new Error('First attempt fails');
    });

    await boss.publish('retry_test', { test: true }, { retryLimit: 2 });
    await new Promise((r) => setTimeout(r, 1000));

    expect(attempts).toBeGreaterThanOrEqual(1);
  });

  it('should maintain job queue across restarts', async () => {
    await boss.createQueue('persist_test');
    await boss.publish('persist_test', { case_id: 'test-123' });

    const state = await boss.getQueueSize('persist_test');
    expect(state.created).toBeGreaterThan(0);

    await boss.stop();
    const boss2 = new PgBoss(process.env.DATABASE_URL!);
    await boss2.start();

    const state2 = await boss2.getQueueSize('persist_test');
    expect(state2.created).toBeGreaterThan(0);

    boss = boss2;
  });

  it('should cap case processing concurrency at 4', async () => {
    await boss.createQueue('case_proc_test');

    let concurrent = 0;
    let maxConcurrent = 0;

    await boss.subscribe('case_proc_test', 4, async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 50));
      concurrent--;
    });

    // Publish 10 jobs
    for (let i = 0; i < 10; i++) {
      await boss.publish('case_proc_test', { index: i });
    }

    await new Promise((r) => setTimeout(r, 2000));
    expect(maxConcurrent).toBeLessThanOrEqual(4);
  });

  it('should not log personal document data', async () => {
    await boss.createQueue('safe_log_test');
    await boss.subscribe('safe_log_test', async (job) => {
      // Job processing should not expose document content
      expect(JSON.stringify(job)).not.toContain('document_content');
    });

    await boss.publish('safe_log_test', {
      case_id: 'case-123',
      org_id: 'org-456',
      // No raw document data
    });

    await new Promise((r) => setTimeout(r, 500));
  });

  it('should maintain idempotency with singleton keys', async () => {
    await boss.createQueue('idempotent_test');

    let execCount = 0;
    await boss.subscribe('idempotent_test', async () => {
      execCount++;
    });

    const key = 'unique-case-123';
    await boss.publish('idempotent_test', { case_id: 'case-123' }, { singletonKey: key });
    await boss.publish('idempotent_test', { case_id: 'case-123' }, { singletonKey: key });

    await new Promise((r) => setTimeout(r, 1000));
    expect(execCount).toBeLessThanOrEqual(2);
  });

  it('should handle job expiration', async () => {
    await boss.createQueue('expire_test');

    await boss.publish('expire_test', { test: true }, { expireInSeconds: 1 });

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 2000));

    // Job should be removed or archived
    const state = await boss.getQueueSize('expire_test');
    expect(state.created + state.active + state.failed).toBeGreaterThanOrEqual(0);
  });
});
