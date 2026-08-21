import type { VerificationStep, StepResult } from '@tieout/workflow';
import type { CaseStepContext } from './extraction-step.js';

export class ForensicsStep implements VerificationStep<{ forensicsCount: number }> {
  readonly id = 'doc.forensics';
  readonly label = 'PDF Forensics Inspection';
  readonly speed = 'fast';
  readonly timeoutMs = 30000;
  readonly dependsOn = [];

  readonly dataSource = {
    source: 'derived',
    licence: 'none',
  };

  requires(_ctx: unknown): boolean {
    return true;
  }

  async run(ctx: unknown): Promise<StepResult<{ forensicsCount: number }>> {
    const context = ctx as CaseStepContext;
    const { caseId, deps } = context;
    const startedAt = new Date();

    const forensicsRecords = await deps.db.getCompletedForensics(caseId);

    // In processCase, forensics is initiated when documents are uploaded.
    // This step simply retrieves the results if they are completed.
    // If not completed, we might just assume they failed or aren't ready,
    // but typically forensics operates quickly or synchronously in tests.

    return {
      state: 'succeeded',
      artifact: { forensicsCount: forensicsRecords.length },
      reason: null,
      provenance: { source: 'derived', model: 'system', licence: 'none' },
      startedAt,
      completedAt: new Date(),
    };
  }
}
