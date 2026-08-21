import type { VerificationStep, StepResult } from '@tieout/workflow';
import type { CaseStepContext } from './extraction-step.js';
import { syncEpfoHistory } from '../../epfo/epfo-service.js';

export class EpfoHistoryStep implements VerificationStep<{ uan: string }> {
  readonly id = 'epfo.history';
  readonly label = 'EPFO Employment History';
  readonly speed = 'fast';
  readonly timeoutMs = 45000;
  readonly dependsOn = [];

  readonly dataSource = {
    source: 'epfo:signzy',
    licence: 'consented',
  };

  requires(_ctx: CaseStepContext): boolean {
    // We always attempt it, but if UAN is missing, it will return not_assessed.
    return true;
  }

  async run(ctx: unknown): Promise<StepResult<{ uan: string }>> {
    const context = ctx as CaseStepContext;
    const { caseId, deps } = context;
    const startedAt = new Date();

    const caseRecord = await deps.db.getCaseById(caseId);
    if (!caseRecord) {
      return {
        state: 'failed',
        artifact: null,
        reason: 'Case not found',
        provenance: { source: 'epfo:signzy', model: null, licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    }

    if (!caseRecord.uan) {
      return {
        state: 'not_assessed',
        artifact: null,
        reason: 'No UAN provided',
        provenance: { source: 'epfo:signzy', model: null, licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    }

    const consent = await deps.db.getConsentByCaseId(caseId);
    if (!consent) {
      return {
        state: 'not_assessed',
        artifact: null,
        reason: 'No consent provided',
        provenance: { source: 'epfo:signzy', model: null, licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    }

    try {
      await syncEpfoHistory(deps, caseId, consent.id, caseRecord.uan);

      return {
        state: 'succeeded',
        artifact: { uan: caseRecord.uan },
        reason: null,
        provenance: { source: 'epfo:signzy', model: null, licence: 'consented' },
        startedAt,
        completedAt: new Date(),
      };
    } catch {
      return {
        state: 'failed',
        artifact: null,
        reason: 'Failed to sync EPFO history',
        provenance: { source: 'epfo:signzy', model: null, licence: 'consented' },
        startedAt,
        completedAt: new Date(),
      };
    }
  }
}
