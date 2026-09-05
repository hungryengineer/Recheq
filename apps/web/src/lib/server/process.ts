import { publishJob } from '@recheq/api/src/workflows/pgboss.js';
import { repository } from './repository';

export async function startProcessing(caseId: string) {
  // Update status to processing synchronously to acknowledge the request
  await repository.updateCaseStatus(caseId, 'processing');

  // We intentionally do not await processCase here to run it asynchronously
  // in the background. Note: in a production Node.js environment,
  // you should use a job queue like pg-boss to ensure reliability.
  try {
    await publishJob('CASE_PROCESSING', { caseId, triggeredBy: 'candidate' });
    console.log(`[Worker] Case ${caseId} processing queued successfully`);
  } catch (err) {
    console.error(`[Worker] Case ${caseId} processing failed:`, err);
  }
}
