import type { EvidenceAssembly, Form16Extraction, PayslipExtraction } from '@tieout/schema';

// ─── EPFO Data Structures ───────────────────────────────────────
export interface EpfoPeriod {
  employerName: string;
  establishmentId: string;
  startDate: string;
  endDate: string | null;
}

export interface EpfoHistory {
  uan: string;
  periods: EpfoPeriod[];
}

// ─── Check Context ──────────────────────────────────────────────
/**
 * Represents the complete assembled evidence for a case,
 * suitable for pure rule engine evaluation.
 */
export interface CheckContext {
  /** Metadata about what evidence is present and what is missing */
  assembly: EvidenceAssembly;

  /** The extracted payslip data, if successfully extracted */
  payslip: PayslipExtraction | null;

  /** The extracted Form 16 data, if successfully extracted */
  form16: Form16Extraction | null;

  /** The EPFO employment history, if successfully fetched */
  epfoHistory: EpfoHistory | null;
}
