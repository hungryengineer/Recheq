import { processCase } from '@tieout/api/src/workflows/case-processing.js';
import { buildDeps } from './deps';
import { repository } from './repository';
import { createRequestContext } from '@tieout/api/src/observability/request-context.js';

export async function startProcessing(caseId: string) {
  // Update status to processing synchronously to acknowledge the request
  await repository.updateCaseStatus(caseId, 'processing');

  // We intentionally do not await processCase here to run it asynchronously
  // in the background. Note: in a production Node.js environment,
  // you should use a job queue like pg-boss to ensure reliability.
  const deps = buildDeps();
  const context = createRequestContext({
    requestId: crypto.randomUUID(),
    service: 'async-worker',
  });

  processCase(caseId, false, deps)
    .then(() => {
      console.log(`[Worker] Case ${caseId} processed successfully`);
    })
    .catch((err) => {
      console.error(`[Worker] Case ${caseId} processing failed:`, err);
      // Fallback status update on catastrophic unhandled error
      repository.updateCaseStatus(caseId, 'withdrawn').catch((e) => {
        console.error(`[Worker] Failed to update fallback status for ${caseId}`, e);
      });
    });
}
