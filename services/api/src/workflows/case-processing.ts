import type { CaseStatus, EventInput, EventRecord } from '@tieout/schema';
import type { Database } from '../db/client.js';
import { checkProcessingIdempotency } from './idempotency.js';
import type { EvidenceServiceDeps } from '../evidence/evidence-service.js';
import type { EpfoProvider } from '../epfo/epfo-provider.js';
import type { LlmDocumentExtractor } from '../extraction/llm-document-extractor.js';
import { Engine } from '@tieout/workflow';
import { ExtractionStep } from './steps/extraction-step.js';
import { ForensicsStep } from './steps/forensics-step.js';
import { EpfoHistoryStep } from './steps/epfo-history-step.js';
import { TriangulateStep, type TriangulateArtifact } from './steps/triangulate-step.js';
import type { EpfoHistory, ScorableFinding } from '@tieout/rules';

export interface CaseProcessingDeps extends EvidenceServiceDeps {
  db: Database &
    EvidenceServiceDeps['db'] & {
      getCaseById: (
        caseId: string,
      ) => Promise<{ id: string; uan: string | null; status: CaseStatus } | null>;
      getConsentByCaseId: (caseId: string) => Promise<{ id: string } | null>;
      updateCaseStatusAndVerdict: (
        tx: unknown,
        caseId: string,
        status: CaseStatus,
        verdict: string,
        riskScore: number,
      ) => Promise<void>;
      replaceFindings: (tx: unknown, caseId: string, findings: ScorableFinding[]) => Promise<void>;
      createPendingRecord: (caseId: string, consentId: string, uan: string) => Promise<string>;
      updateRecordSuccess: (id: string, history: EpfoHistory) => Promise<void>;
      updateRecordFailure: (id: string, error: string) => Promise<void>;
      getDocumentContent: (documentId: string) => Promise<{ content: string; mimeType: string }>;
      transaction: <T>(cb: (tx: unknown) => Promise<T>) => Promise<T>;
    };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<EventRecord>;
  };
  epfoProvider: EpfoProvider;
  extractor: LlmDocumentExtractor;
}

export async function processCase(
  caseId: string,
  isReprocess: boolean,
  deps: CaseProcessingDeps,
): Promise<void> {
  const caseRecord = await deps.db.getCaseById(caseId);
  if (!caseRecord) {
    throw new Error(`Case ${caseId} not found`);
  }

  // 1. Check idempotency and state
  checkProcessingIdempotency(caseRecord.status, isReprocess);

  // 2. Initialize Workflow Engine
  const engine = new Engine([
    new ExtractionStep(),
    new ForensicsStep(),
    new EpfoHistoryStep(),
    new TriangulateStep(),
  ]);

  const ctx = {
    caseId,
    deps,
  };

  // 3. Execute Verification Steps
  const engineResult = await engine.run(ctx);

  // 4. Retrieve Triangulate Result
  const triangulateResult = engineResult.steps.find((s) => s.id === 'rules.triangulate');

  if (triangulateResult && triangulateResult.state === 'succeeded' && triangulateResult.artifact) {
    const { findings, verdict, score } = triangulateResult.artifact as TriangulateArtifact;

    // 5. Transactional Commit
    await deps.db.transaction(async (tx) => {
      await deps.db.replaceFindings(tx, caseId, findings);
      await deps.db.updateCaseStatusAndVerdict(tx, caseId, 'complete', verdict, score);

      await deps.audit.appendEvent(tx, {
        case_id: caseId,
        kind: 'verdict_calculated',
        payload: {
          verdict,
          risk_score: score,
          finding_count: findings.length,
          is_reprocess: isReprocess,
        },
        actor: 'system',
      });
    });
  } else {
    // If triangulation failed or didn't run due to dependencies, fail the case
    await deps.db.transaction(async (tx) => {
      await deps.db.updateCaseStatusAndVerdict(
        tx,
        caseId,
        'complete',
        engineResult.verdict,
        100, // max risk for unverified
      );
    });
  }
}
