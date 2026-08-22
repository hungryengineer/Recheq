import type { VerificationStep, StepResult } from '@tieout/workflow';
import type { CaseStepContext } from '../case-processing.js';

export class ForensicsStep implements VerificationStep<
  CaseStepContext,
  { forensicsCount: number }
> {
  readonly id = 'doc.forensics';
  readonly label = 'PDF Forensics Inspection';
  readonly speed = 'fast';
  readonly timeoutMs = 30000;
  readonly dependsOn = [];

  readonly dataSource = {
    source: 'derived',
    licence: 'none',
  };

  requires(_ctx: CaseStepContext): boolean {
    return true;
  }

  async run(ctx: CaseStepContext): Promise<StepResult<{ forensicsCount: number }>> {
    const { caseId, deps } = ctx;
    const startedAt = new Date();

    const forensicsRecords = await deps.db.getCompletedForensics(caseId);

    if (forensicsRecords.length === 0) {
      return {
        state: 'not_assessed',
        artifact: null,
        reason: 'No forensic records available',
        provenance: { source: 'derived', model: 'system', licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    }

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
