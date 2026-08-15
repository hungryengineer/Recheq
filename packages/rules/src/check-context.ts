import type { EvidenceAssembly, Form16Extraction, PayslipExtraction } from '@tieout/schema';

// ─── Forensics Data ──────────────────────────────────────────────
export interface FontRunAnalysis {
  total_characters: number;
  unique_fonts: number;
  dominant_font: string;
  anomalous_characters: number;
}

export interface MonetaryAnomalyAnalysis {
  flagged_regions: number;
  highest_confidence_anomaly: number;
}

export interface ForensicsData {
  producer: string | null;
  creator: string | null;
  creation_date: Date | null;
  modification_date: Date | null;
  font_runs: FontRunAnalysis | null;
  monetary_anomalies: MonetaryAnomalyAnalysis | null;
}

// ─── EPFO Data Structures ──────────────────────────────────────
export interface EpfoContribution {
  /** YYYY-MM */
  month: string;
  employee_share: number;
  employer_share: number;
}

export interface EpfoPeriod {
  employerName: string;
  establishmentId: string;
  startDate: string;
  endDate: string | null;
  contributions: EpfoContribution[];
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

  /** The forensics data extracted from document files */
  forensics: ForensicsData[] | null;
}
