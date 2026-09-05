/* eslint-disable @typescript-eslint/no-unused-vars */
import { processCase } from '@recheq/api/src/workflows/case-processing.js';
import { buildDeps } from './deps';
import { repository } from './repository';
import { createRequestContext } from '@recheq/api/src/observability/request-context.js';

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

  try {
    await processCase(caseId, false, deps);
    console.log(`[Worker] Case ${caseId} processed successfully`);
  } catch (err) {
    // Catastrophic failure outside the engine's own transactional fallback
    // (e.g. dependency construction or DB unavailable). Never mark the case
    // `withdrawn` here — withdrawal is a candidate action, not an error
    // state; the case stays `processing` so a verifier can reprocess it.
    console.error(`[Worker] Case ${caseId} processing failed:`, err);
  }
}
