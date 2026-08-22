import type { VerificationStep, StepResult } from '@tieout/workflow';
import type { CaseStepContext } from '../case-processing.js';
import { syncEpfoHistory } from '../../epfo/epfo-service.js';

export class EpfoHistoryStep implements VerificationStep<CaseStepContext, { uan: string }> {
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

  async run(ctx: CaseStepContext): Promise<StepResult<{ uan: string }>> {
    const { caseId, deps } = ctx;
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
      const result = await syncEpfoHistory(deps, caseId, consent.id, caseRecord.uan);

      if (result.ok) {
        return {
          state: 'succeeded',
          artifact: { uan: caseRecord.uan },
          reason: null,
          provenance: { source: 'epfo:signzy', model: null, licence: 'consented' },
          startedAt,
          completedAt: new Date(),
        };
      }
      // R1.16: a declared source that is unavailable — no history found OR
      // the provider call failing/rejecting (absorbed by syncEpfoHistory per
      // BE-11 "provider failure causes dependent rules to be not assessed") —
      // is final unavailability: mark not_assessed with a candidate-safe
      // reason, never failed, never an undeclared fallback. Only faults
      // outside the provider contract (e.g. persistence errors) throw and
      // take the R1.10 catch path below.
      return {
        state: 'not_assessed',
        artifact: null,
        reason: 'Employment history could not be verified right now',
        provenance: { source: 'epfo:signzy', model: null, licence: 'consented' },
        startedAt,
        completedAt: new Date(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Raw EPFO error for case ${caseId}: ${msg}`);
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
