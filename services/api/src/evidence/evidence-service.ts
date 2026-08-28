import type { CheckContext, ForensicsData } from '@tieout/rules';
import type {
  EvidenceOrigin,
  EvidenceAssembly,
  PayslipExtraction,
  Form16Extraction,
} from '@tieout/schema';
import type { EpfoHistory } from '../epfo/epfo-provider.js';

export interface EvidenceServiceDeps {
  db: {
    getCaseById: (caseId: string) => Promise<{ claimed_ctc: string; id: string; uan: string | null; status: unknown } | null>;
    getDocumentsForCase: (
      caseId: string,
    ) => Promise<Array<{ id: string; kind: string; created_at: Date }>>;
    getSuccessfulExtractions: (
      documentIds: string[],
    ) => Promise<Array<{ document_id: string; extracted_data: unknown }>>;
    getCompletedEpfoRecords: (caseId: string) => Promise<Array<{ employment_history: unknown }>>;
    getCompletedForensics: (caseId: string) => Promise<Array<ForensicsData>>;
  };
}

export async function assembleEvidence(
  deps: EvidenceServiceDeps,
  caseId: string,
): Promise<CheckContext> {
  const caseRecord = await deps.db.getCaseById(caseId);
  if (!caseRecord) throw new Error(`Case ${caseId} not found`);

  // 1. Fetch all documents for the case
  const docs = await deps.db.getDocumentsForCase(caseId);

  // Sort descending by created_at to get the newest document of each kind
  docs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  // Wait, if a document was uploaded but extraction failed, the newest might not have a successful extraction.
  // We should ideally fetch successful extractions for ALL documents of that case, and then match the newest document that HAS a successful extraction.

  const docIds = docs.map((d) => d.id);
  const extractions = docIds.length > 0 ? await deps.db.getSuccessfulExtractions(docIds) : [];

  const extractionMap = new Map<string, unknown>();
  for (const ext of extractions) {
    extractionMap.set(ext.document_id, ext.extracted_data);
  }

  let payslip: PayslipExtraction | null = null;
  let form16: Form16Extraction | null = null;

  // Since docs are sorted descending (newest first), the first one we find that has a successful extraction is the best one.
  for (const d of docs) {
    if (d.kind === 'payslip' && !payslip && extractionMap.has(d.id)) {
      payslip = extractionMap.get(d.id) as PayslipExtraction;
    }
    if (d.kind === 'form_16' && !form16 && extractionMap.has(d.id)) {
      form16 = extractionMap.get(d.id) as Form16Extraction;
    }
  }

  // 3. Fetch completed EPFO record
  const epfoRecords = await deps.db.getCompletedEpfoRecords(caseId);
  const epfoRecord = epfoRecords[0];
  const epfoHistory: EpfoHistory | null = epfoRecord?.employment_history
    ? (epfoRecord.employment_history as EpfoHistory)
    : null;

  // 4. Fetch Forensics records
  const forensicsRecords = await deps.db.getCompletedForensics(caseId);

  // 5. Assemble the context
  const origins: EvidenceOrigin[] = [];
  if (payslip) origins.push('payslip');
  if (form16) origins.push('form_16');
  if (epfoHistory) origins.push('epfo');
  if (forensicsRecords.length > 0) origins.push('forensics');
  // employer not yet implemented

  const assembly: EvidenceAssembly = {
    case_id: caseId,
    origins,
    has_payslip: !!payslip,
    has_form16: !!form16,
    has_epfo: !!epfoHistory,
    has_employer: false,
    has_forensics: forensicsRecords.length > 0,
  };

  return {
    claimed_ctc: Number(caseRecord.claimed_ctc),
    assembly,
    payslip,
    form16,
    epfoHistory,
    forensics: forensicsRecords.length > 0 ? forensicsRecords : null,
  };
}
