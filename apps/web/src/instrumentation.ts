import { _initSecretKey } from '@recheq/api/src/security/jwt.js';

export async function register() {
  // Validate JWT secret on API startup
  _initSecretKey();

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startWorkers } = await import('@recheq/api/src/workers/worker.js');
      await startWorkers();
    } catch (err) {
      console.error('Failed to start workers', err);
    }
  }
}
