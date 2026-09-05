import type { CaseStatus, EventInput, EventRecord } from '@recheq/schema';
import type { Database } from '../db/client.js';
import { checkProcessingIdempotency } from './idempotency.js';
import type { EvidenceServiceDeps } from '../evidence/evidence-service.js';
import type { EpfoProvider } from '../epfo/epfo-provider.js';
import type { LlmDocumentExtractor } from '../extraction/llm-document-extractor.js';
import { Engine, type StepContext, type EngineResult } from '@recheq/workflow';
import { ExtractionStep } from './steps/extraction-step.js';
import { ForensicsStep } from './steps/forensics-step.js';
import { EpfoHistoryStep } from './steps/epfo-history-step.js';
import { TriangulateStep, type TriangulateArtifact } from './steps/triangulate-step.js';
import type { EpfoHistory, ScorableFinding } from '@recheq/rules';

export interface CaseProcessingDeps extends EvidenceServiceDeps {
  db: Database &
    EvidenceServiceDeps['db'] & {
      getCaseById: (caseId: string) => Promise<{
        id: string;
        uan: string | null;
        status: CaseStatus;
        claimed_ctc: string;
      } | null>;
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
      createExtraction: (
        docId: string,
        metadata: { modelId: string; schemaVersion: string },
      ) => Promise<string>;
      updateExtractionSuccess: (
        id: string,
        data: unknown,
        usage?: unknown,
        modelId?: string,
      ) => Promise<void>;
      updateExtractionFailure: (id: string, error: string, usage?: unknown) => Promise<void>;
      getDocumentContent: (documentId: string) => Promise<{ content: string; mimeType: string }>;
      transaction: <T>(cb: (tx: unknown) => Promise<T>) => Promise<T>;
    };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<EventRecord>;
  };
  epfoProvider: EpfoProvider;
  extractor: LlmDocumentExtractor;
}

export interface CaseStepContext extends StepContext {
  caseId: string;
  deps: CaseProcessingDeps;
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
  const engine = new Engine<CaseStepContext>([
    new ExtractionStep(),
    new ForensicsStep(),
    new EpfoHistoryStep(),
    new TriangulateStep(),
  ]);

  const ctx: CaseStepContext = {
    caseId,
    deps,
  };

  // 3. Execute Verification Steps
  let engineResult: EngineResult;
  try {
    engineResult = await engine.run(ctx);
  } catch (err) {
    if (err instanceof Error && err.name === 'RecoverableWorkflowError') {
      throw err; // Re-throw to the worker so it retries
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Engine failed for case ${caseId}:`, err);
    await deps.db.transaction(async (tx) => {
      await deps.db.replaceFindings(tx, caseId, []);
      await deps.db.updateCaseStatusAndVerdict(
        tx,
        caseId,
        'complete',
        'insufficient_evidence',
        100,
      );
      await deps.audit.appendEvent(tx, {
        case_id: caseId,
        kind: 'verdict_calculated',
        payload: {
          verdict: 'insufficient_evidence',
          risk_score: 100,
          finding_count: 0,
          is_reprocess: isReprocess,
          failure_reason: `Engine failure: ${msg}`,
        },
        actor: 'system',
      });
    });
    return;
  }

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
    const UNVERIFIED_RISK_SCORE = 100;
    const failureReason = triangulateResult?.reason ?? 'Triangulation did not run';

    await deps.db.transaction(async (tx) => {
      await deps.db.replaceFindings(tx, caseId, []);
      await deps.db.updateCaseStatusAndVerdict(
        tx,
        caseId,
        'complete',
        engineResult.verdict,
        UNVERIFIED_RISK_SCORE,
      );

      await deps.audit.appendEvent(tx, {
        case_id: caseId,
        kind: 'verdict_calculated',
        payload: {
          verdict: engineResult.verdict,
          risk_score: UNVERIFIED_RISK_SCORE,
          finding_count: 0,
          is_reprocess: isReprocess,
          failure_reason: failureReason,
        },
        actor: 'system',
      });
    });
  }
}
