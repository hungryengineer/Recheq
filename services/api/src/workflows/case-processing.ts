import type { CaseStatus, EventInput, EventRecord } from '@tieout/schema';
import { calculateVerdict, calculateRiskScore } from '@tieout/rules';
import type { Database } from '../db/client.js';
import { checkProcessingIdempotency } from './idempotency.js';
import { assembleEvidence, type EvidenceServiceDeps } from '../evidence/evidence-service.js';
import { runAllChecks } from '@tieout/rules';
import { syncEpfoHistory } from '../epfo/epfo-service.js';
import type { EpfoProvider } from '../epfo/epfo-provider.js';
import type { LlmDocumentExtractor } from '../extraction/llm-document-extractor.js';
import { 
  createExtraction, 
  updateExtractionSuccess, 
  updateExtractionFailure 
} from '../extraction/extraction-service.js';

export interface CaseProcessingDeps extends EvidenceServiceDeps {
  db: EvidenceServiceDeps['db'] & {
    getCaseById: (caseId: string) => Promise<{ id: string; uan: string | null; status: CaseStatus } | null>;
    getConsentByCaseId: (caseId: string) => Promise<{ id: string } | null>;
    updateCaseStatusAndVerdict: (
      caseId: string, 
      status: CaseStatus, 
      verdict: string, 
      riskScore: number
    ) => Promise<void>;
    replaceFindings: (caseId: string, findings: any[]) => Promise<void>;
    createPendingRecord: (caseId: string, consentId: string, uan: string) => Promise<string>;
    updateRecordSuccess: (id: string, history: any) => Promise<void>;
    updateRecordFailure: (id: string, error: string) => Promise<void>;
    getDocumentContent: (documentId: string) => Promise<{ content: string; mimeType: string }>;
  };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<EventRecord>;
  };
  epfoProvider: EpfoProvider;
  extractor: LlmDocumentExtractor;
}

export async function processCase(caseId: string, isReprocess: boolean, deps: CaseProcessingDeps): Promise<void> {
  const caseRecord = await deps.db.getCaseById(caseId);
  if (!caseRecord) {
    throw new Error(`Case ${caseId} not found`);
  }

  // 1. Check idempotency and state
  checkProcessingIdempotency(caseRecord.status, isReprocess);

  // 2. Extractions and Forensics
  const documents = await deps.db.getDocumentsForCase(caseId);
  
  // Find which documents don't have extractions yet
  const docIds = documents.map(d => d.id);
  const existingExtractions = docIds.length > 0 ? await deps.db.getSuccessfulExtractions(docIds) : [];
  const extractedDocIds = new Set(existingExtractions.map(e => e.document_id));

  const extractionPromises = documents
    .filter(doc => !extractedDocIds.has(doc.id))
    .map(async doc => {
      // Create pending extraction
      const extId = await createExtraction(deps.db as any, doc.id, {
        modelId: 'default',
        schemaVersion: doc.kind === 'payslip' ? 'payslip-v1' : 'form16-v1',
      });

      try {
        const docContent = await deps.db.getDocumentContent(doc.id);
        
        const req = {
          documentId: doc.id,
          documentKind: doc.kind as 'payslip' | 'form_16',
          documentContent: docContent.content,
          mimeType: docContent.mimeType,
          schemaVersion: doc.kind === 'payslip' ? 'payslip-v1' : 'form16-v1',
        };
        
        const result = doc.kind === 'payslip' 
          ? await deps.extractor.extractPayslip(req)
          : await deps.extractor.extractForm16(req);

        await updateExtractionSuccess(deps.db as any, extId, result.data, result.usage);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateExtractionFailure(deps.db as any, extId, msg);
      }
    });

  // 3. EPFO
  let epfoPromise: Promise<string | null> = Promise.resolve(null);
  if (caseRecord.uan) {
    const consent = await deps.db.getConsentByCaseId(caseId);
    if (consent) {
      epfoPromise = syncEpfoHistory(deps, caseId, consent.id, caseRecord.uan);
    }
  }

  // Wait for all async dependencies
  await Promise.all([
    Promise.all(extractionPromises),
    epfoPromise
  ]);

  // 4. Assemble Evidence
  const ctx = await assembleEvidence(deps, caseId);

  // 5. Run Rules
  const findings = runAllChecks(ctx);

  // 6. Calculate Verdict
  const score = calculateRiskScore(findings as any);
  const verdict = calculateVerdict(findings as any, ctx.assembly.origins.length);

  // 7. Transactional Commit
  await deps.db.replaceFindings(caseId, findings);
  await deps.db.updateCaseStatusAndVerdict(caseId, 'complete', verdict, score);

  await deps.audit.appendEvent(null, {
    case_id: caseId,
    kind: 'verdict_calculated',
    payload: {
      verdict,
      risk_score: score,
      finding_count: findings.length,
      is_reprocess: isReprocess
    },
    actor: 'system'
  });
}
