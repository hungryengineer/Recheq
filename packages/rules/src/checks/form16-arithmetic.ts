import type { FindingInput } from '@recheq/schema';
import type { RuleFunction } from '../check.js';
import { FORM16_ARITHMETIC_TOLERANCE } from '../constants.js';

/**
 * Verifies the Part B arithmetic of a Form 16:
 * Gross Total Income - Exempt Allowances - Standard Deduction - Professional Tax
 * must equal the Net Taxable Salary printed on the document.
 */
export const checkForm16Arithmetic: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_form16 || !ctx.form16) {
    return [
      {
        rule_id: 'form16-arithmetic',
        severity: 'high',
        status: 'not_assessed',
        title: 'Form-16 Arithmetic Unverified',
        explanation: 'Form-16 extraction data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const f = ctx.form16;
  const findings: FindingInput[] = [];

  if (
    f.gross_total_income !== null &&
    f.exempt_allowances !== null &&
    f.standard_deduction !== null &&
    f.professional_tax !== null &&
    f.net_taxable_salary !== null
  ) {
    const calculatedNet =
      f.gross_total_income - f.exempt_allowances - f.standard_deduction - f.professional_tax;
    const diff = Math.abs(calculatedNet - f.net_taxable_salary);

    if (diff > FORM16_ARITHMETIC_TOLERANCE) {
      findings.push({
        rule_id: 'form16-arithmetic',
        severity: 'high',
        status: 'open',
        title: 'Form-16 Net Taxable Salary Mismatch',
        explanation:
          'Gross total income minus exempt allowances, standard deduction and professional tax does not equal the stated net taxable salary.',
        expected: String(calculatedNet),
        observed: String(f.net_taxable_salary),
        source_document_ids: [],
      });
    }
  }

  return findings;
};
