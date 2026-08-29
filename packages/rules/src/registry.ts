import type { RuleFunction } from './check.js';

import { checkPayslipArithmetic } from './checks/payslip-arithmetic.js';
import { checkPfImpliesBasic } from './checks/pf-implies-basic.js';
import { checkPfMatchesEpfo } from './checks/pf-matches-epfo.js';
import { checkDualEmployment } from './checks/dual-employment.js';
import { checkDatesWithinEpfoPeriod } from './checks/dates-within-epfo-period.js';
import { checkForm16ReconcilesPayslip } from './checks/form16-reconciles-payslip.js';
import { checkForm16Arithmetic } from './checks/form16-arithmetic.js';
import { checkForm16IdentifierFormat } from './checks/form16-identifier-format.js';
import { checkEmployerNameMatch } from './checks/employer-name-match.js';
import { checkIdentityConsistent } from './checks/identity-consistent.js';
import { checkCtcPlausible } from './checks/ctc-plausible.js';
import { checkForensicsMetadata } from './checks/forensics-metadata.js';
import { checkEpfoGapAnalysis } from './checks/epfo-gap-analysis.js';
import { checkDocumentConfidence } from './checks/document-confidence.js';

/**
 * The Rule Registry.
 *
 * This explicitly lists all 14 active deterministic rules that run
 * on every background verification case.
 *
 * Note: Missing 15th Rule
 * Per specification BE-12, the 15th rule (e.g. Identity Document Number Match)
 * is documented rather than invented. Since we don't process candidate ID uploads
 * in this iteration, identity-document-match is intentionally excluded.
 */
export const RULE_REGISTRY: Record<string, RuleFunction> = {
  'payslip-arithmetic': checkPayslipArithmetic,
  'pf-implies-basic': checkPfImpliesBasic,
  'pf-matches-epfo': checkPfMatchesEpfo,
  'dual-employment': checkDualEmployment,
  'dates-within-epfo-period': checkDatesWithinEpfoPeriod,
  'form16-reconciles-payslip': checkForm16ReconcilesPayslip,
  'form16-arithmetic': checkForm16Arithmetic,
  'form16-identifier-format': checkForm16IdentifierFormat,
  'employer-name-match': checkEmployerNameMatch,
  'identity-consistent': checkIdentityConsistent,
  'ctc-plausible': checkCtcPlausible,
  'forensics-metadata': checkForensicsMetadata,
  'epfo-gap-analysis': checkEpfoGapAnalysis,
  'document-confidence': checkDocumentConfidence,
};
