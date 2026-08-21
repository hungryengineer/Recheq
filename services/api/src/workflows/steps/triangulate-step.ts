import type { VerificationStep, StepResult } from '@tieout/workflow';
import type { CaseStepContext } from '../case-processing.js';
import { calculateVerdict, calculateRiskScore, runAllChecks } from '@tieout/rules';
import type { FindingInput } from '@tieout/schema';
import { assembleEvidence } from '../../evidence/evidence-service.js';

export interface TriangulateArtifact {
  findings: FindingInput[];
  verdict: ReturnType<typeof calculateVerdict>;
  score: number;
}

export class TriangulateStep implements VerificationStep<CaseStepContext, TriangulateArtifact> {
  readonly id = 'rules.triangulate';
  readonly label = 'Rule Triangulation';
  readonly speed = 'fast';
  readonly timeoutMs = 15000;
  readonly dependsOn = ['doc.extract', 'doc.forensics', 'epfo.history'];

  readonly dataSource = {
    source: 'derived',
    licence: 'none',
  };

  requires(_ctx: CaseStepContext): boolean {
    return true;
  }

  async run(ctx: CaseStepContext): Promise<StepResult<TriangulateArtifact>> {
    const { caseId, deps } = ctx;
    const startedAt = new Date();

    try {
      const evidenceCtx = await assembleEvidence(deps, caseId);

      const findings = runAllChecks(evidenceCtx);

      const score = calculateRiskScore(findings);
      const verdict = calculateVerdict(findings, evidenceCtx.assembly.origins.length);

      return {
        state: 'succeeded',
        artifact: {
          findings,
          verdict,
          score,
        },
        reason: null,
        provenance: { source: 'derived', model: null, licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        state: 'failed',
        artifact: null,
        reason: `Triangulation failed: ${msg}`,
        provenance: { source: 'derived', model: 'system', licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    }
  }
}
