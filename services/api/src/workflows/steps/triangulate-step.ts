import type { VerificationStep, StepResult } from '@tieout/workflow';
import type { CaseStepContext } from './extraction-step.js';
import { calculateVerdict, calculateRiskScore, runAllChecks } from '@tieout/rules';
import type { ScorableFinding } from '@tieout/rules';
import { assembleEvidence } from '../../evidence/evidence-service.js';

export interface TriangulateArtifact {
  findings: ScorableFinding[];
  verdict: ReturnType<typeof calculateVerdict>;
  score: number;
}

export class TriangulateStep implements VerificationStep<TriangulateArtifact> {
  readonly id = 'rules.triangulate';
  readonly label = 'Rule Triangulation';
  readonly speed = 'fast';
  readonly timeoutMs = 15000;
  readonly dependsOn = ['doc.extract', 'doc.forensics', 'epfo.history'];

  readonly dataSource = {
    source: 'derived',
    licence: 'none',
  };

  requires(_ctx: unknown): boolean {
    return true;
  }

  async run(ctx: unknown): Promise<StepResult<TriangulateArtifact>> {
    const context = ctx as CaseStepContext;
    const { caseId, deps } = context;
    const startedAt = new Date();

    try {
      const evidenceCtx = await assembleEvidence(deps, caseId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const findings = runAllChecks(evidenceCtx) as any[];

      const score = calculateRiskScore(findings as ScorableFinding[]);
      const verdict = calculateVerdict(
        findings as Parameters<typeof calculateVerdict>[0],
        evidenceCtx.assembly.origins.length,
      );

      return {
        state: 'succeeded',
        artifact: {
          findings: findings as ScorableFinding[],
          verdict,
          score,
        },
        reason: null,
        provenance: { source: 'derived', model: null, licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    } catch {
      return {
        state: 'failed',
        artifact: null,
        reason: 'Triangulation failed',
        provenance: { source: 'derived', model: null, licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    }
  }
}
