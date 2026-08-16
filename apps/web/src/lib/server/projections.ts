import { repository } from './repository';
import { db } from './db';

export async function projectCaseDetail(caseId: string, orgId: string) {
  const caseRecord = await repository.getCaseByIdAndOrg(caseId, orgId);
  if (!caseRecord) return null;

  const findings = await repository.getFindingsForCase(caseId);
  const documents = await repository.getDocumentsForCase(caseId);
  const consent = await repository.getConsentByCaseId(caseId);

  // Fetch extraction statuses
  const docIds = documents.map((d) => d.id);
  const extractions = await db.query.extractions.findMany({
    where: (extractions, { inArray }) =>
      inArray(
        extractions.document_id,
        docIds.length ? docIds : ['00000000-0000-0000-0000-000000000000'],
      ),
  });

  const extractionMap = new Map(extractions.map((e) => [e.document_id, e.status]));

  // Build documents list
  const projectedDocs = documents.map((doc) => ({
    id: doc.id,
    kind: doc.kind,
    uploaded_at: doc.uploaded_at.toISOString(),
    extraction_status:
      extractionMap.get(doc.id) === 'success'
        ? 'ok'
        : extractionMap.get(doc.id) === 'failed'
          ? 'failed'
          : 'pending',
  }));

  // Separate findings and not_assessed
  const projectedFindings = [];
  const projectedNotAssessed = [];

  for (const f of findings) {
    if (f.status === 'not_assessed') {
      projectedNotAssessed.push({
        rule_id: f.rule_id,
        title: f.title,
        reason: f.explanation,
      });
    } else {
      // Resolve source documents
      let source_label: string | null = null;
      if (f.source_document_ids && f.source_document_ids.length > 0) {
        const doc = documents.find((d) => d.id === f.source_document_ids![0]);
        if (doc) {
          source_label =
            doc.kind === 'payslip' ? 'Payslip' : doc.kind === 'form_16' ? 'Form 16' : doc.kind;
        }
      }

      projectedFindings.push({
        id: f.id,
        rule_id: f.rule_id,
        severity: f.severity,
        status: f.status,
        title: f.title,
        explanation: f.explanation,
        expected: f.expected,
        observed: f.observed,
        source_document_ids: f.source_document_ids || [],
        source_label,
      });
    }
  }

  // Calculate origins
  const origins = new Set<string>();
  if (documents.some((d) => d.kind === 'payslip')) origins.add('payslip');
  if (documents.some((d) => d.kind === 'form_16')) origins.add('form_16');

  const epfoRecords = await repository.getCompletedEpfoRecords(caseId);
  if (epfoRecords.length > 0) origins.add('epfo');

  const consentInfo = consent
    ? {
        granted_at: consent.granted_at ? consent.granted_at.toISOString() : null,
        withdrawn_at: consent.withdrawn_at ? consent.withdrawn_at.toISOString() : null,
        version: consent.consent_version,
      }
    : null;

  return {
    id: caseRecord.id,
    candidate_name: caseRecord.candidate_name,
    employer_name: caseRecord.employer_name,
    title: caseRecord.title,
    claimed_ctc: caseRecord.claimed_ctc,
    employment_start: caseRecord.employment_start,
    employment_end: caseRecord.employment_end,
    uan: caseRecord.uan,
    status: caseRecord.status,
    verdict: caseRecord.verdict,
    risk_score: caseRecord.risk_score,
    origins: Array.from(origins),
    findings: projectedFindings,
    not_assessed: projectedNotAssessed,
    consent: consentInfo,
    documents: projectedDocs,
  };
}
