// ─── @tieout/schema ─────────────────────────────────────────────
// Barrel re-export of all shared domain types and enums.

export {
  CaseStatus,
  Verdict,
  FindingSeverity,
  FindingStatus,
  DocumentKind,
  DocumentStatus,
  ConsentStatus,
  TokenPurpose,
  EventKind,
} from './enums.js';

export { CaseCreateInput, CaseUpdateInput, CaseRecord, CaseSummary } from './case.js';
export * from './auth.js';

export { DocumentRecord, DocumentUploadInput } from './document.js';

export { FindingRecord, FindingInput } from './finding.js';

export { ConsentRecord, ConsentGrantInput } from './consent.js';

export { EvidenceOrigin, EvidenceAssembly } from './evidence.js';

export { EventRecord, EventInput } from './event.js';

export { SalaryComponent, PayslipExtraction } from './payslip.js';

export { Form16Extraction } from './form16.js';
export * from './settings.js';
