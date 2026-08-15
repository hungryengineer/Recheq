import { getPgBoss } from '../workflows/pgboss.js';
import { logger } from '../observability/logger.js';

export interface WorkerHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  queues: QueueHealth[];
  timestamp: Date;
  workerId: string;
}

export interface QueueHealth {
  name: string;
  created: number;
  active: number;
  completed: number;
  failed: number;
  retryable: number;
  archived: number;
}

const WORKER_ID = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export async function getWorkerHealth(): Promise<WorkerHealth> {
  try {
    const boss = await getPgBoss();

    const queues = await boss.getQueues();
    const queueStates = await Promise.all(
      queues.map(async (queue) => {
        const state = await boss.getQueueSize(queue);
        return {
          name: queue,
          created: state.created || 0,
          active: state.active || 0,
          completed: state.completed || 0,
          failed: state.failed || 0,
          retryable: state.retryable || 0,
          archived: state.archived || 0,
        };
      }),
    );

    const totalFailed = queueStates.reduce((sum, q) => sum + q.failed, 0);

    const status = totalFailed > 100 ? 'degraded' : 'healthy';

    return {
      status,
      queues: queueStates,
      timestamp: new Date(),
      workerId: WORKER_ID,
    };
  } catch (error) {
    logger.error('failed to get worker health', { error: (error as Error).message });
    return {
      status: 'unavailable',
      queues: [],
      timestamp: new Date(),
      workerId: WORKER_ID,
    };
  }
}

export async function reportWorkerHealth(): Promise<void> {
  const health = await getWorkerHealth();
  logger.info('worker health report', {
    status: health.status,
    queueCount: health.queues.length,
    totalActive: health.queues.reduce((sum, q) => sum + q.active, 0),
    totalFailed: health.queues.reduce((sum, q) => sum + q.failed, 0),
  });
}
