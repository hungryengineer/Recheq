import type { ProcessCaseJob } from '../workflows/job-types.js';
import { processCase, type CaseProcessingDeps } from '../workflows/case-processing.js';

export class CaseProcessingWorker {
  constructor(private readonly deps: CaseProcessingDeps) {}

  /**
   * Worker entry point for case processing.
   * Catches errors gracefully to prevent crashing the worker process.
   */
  async handleJob(job: ProcessCaseJob): Promise<void> {
    try {
      const isReprocess = job.triggeredBy === 'verifier';
      await processCase(job.caseId, isReprocess, this.deps);
      // Log success
      console.log(`Successfully processed case: ${job.caseId}`);
    } catch (error) {
      // In a real worker, we would log the error using the observability logger
      // and possibly re-throw or move the job to a dead letter queue.
      console.error(`Failed to process case ${job.caseId}:`, error);
      throw error;
    }
  }
}
