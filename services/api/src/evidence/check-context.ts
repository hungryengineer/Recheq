import type { EvidenceAssembly, PayslipExtraction, Form16Extraction } from '@tieout/schema';
import type { EpfoHistory } from '../epfo/epfo-provider.js';

/**
 * Represents the complete assembled evidence for a case,
 * suitable for rule engine evaluation.
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
  
  // Note: employer verification data would go here once implemented
}
