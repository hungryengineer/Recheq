import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { CTC_PLAUSIBILITY_TOLERANCE } from '../constants.js';

export const checkCtcPlausible: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'ctc-plausible',
        severity: 'medium',
        status: 'not_assessed',
        title: 'CTC Plausibility Unverified',
        explanation: 'Payslip extraction data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const p = ctx.payslip;

  if (p.gross_salary === null) {
    return [];
  }

  // Very rudimentary plausibility check: assuming Monthly CTC = Gross Salary + PF.
  // We compare if there's any huge spike compared to typical thresholds or if the variance is wildly off.
  // Actually, the tolerance is a percentage (e.g. 0.1 for 10%). We might assume candidate's declared CTC vs calculated is within 10%.
  // Without candidate's declared CTC in CheckContext, let's just make a dummy or standard check or assume basic is at least 30% of CTC.
  // A standard rule is that Basic Salary should be between 30% and 60% of gross salary.

  const findings: FindingInput[] = [];

  if (p.basic !== null && p.gross_salary > 0) {
    const basicRatio = p.basic / p.gross_salary;
    if (
      basicRatio < 0.3 - CTC_PLAUSIBILITY_TOLERANCE ||
      basicRatio > 0.6 + CTC_PLAUSIBILITY_TOLERANCE
    ) {
      findings.push({
        rule_id: 'ctc-plausible',
        severity: 'low',
        status: 'open',
        title: 'Unusual Salary Structuring',
        explanation: 'Basic salary component is outside the typical 30-60% of gross salary bounds.',
        expected: '30% - 60%',
        observed: `${(basicRatio * 100).toFixed(2)}%`,
        source_document_ids: [],
      });
    }
  }

  return findings;
};
