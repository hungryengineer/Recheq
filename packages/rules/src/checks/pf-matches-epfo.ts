import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { PAYSLIP_ARITHMETIC_TOLERANCE } from '../constants.js';

/**
 * pf-matches-epfo
 *
 * Compares the payslip pf_deduction for the payslip month against the
 * employee_share filed by the employer in the EPFO record for that same month.
 *
 * The employer files EPFO contributions independently — the candidate cannot
 * alter them. A discrepancy between the two is strong evidence of forgery.
 *
 * Strategy: find the latest contribution month across all periods, compare
 * its employee_share to the payslip pf_deduction.
 */
export const checkPfMatchesEpfo: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_epfo || !ctx.epfoHistory || !ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'pf-matches-epfo',
        severity: 'high',
        status: 'not_assessed',
        title: 'PF vs EPFO Match Unverified',
        explanation: 'Requires both EPFO history with contributions and payslip extraction data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const p = ctx.payslip;

  if (p.pf_deduction === null) {
    return [];
  }

  // Build a flat list of all contributions across all periods
  const allContributions = ctx.epfoHistory.periods.flatMap((period) =>
    (period.contributions ?? []).map((c) => ({
      month: c.month,
      employee_share: c.employee_share,
      employerName: period.employerName,
    })),
  );

  if (allContributions.length === 0) {
    return [
      {
        rule_id: 'pf-matches-epfo',
        severity: 'high',
        status: 'not_assessed',
        title: 'PF vs EPFO Match Unverified',
        explanation: 'EPFO record contains no monthly contribution data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  // Find the payslip month in YYYY-MM format
  const payslipMonth =
    p.year !== null && p.month !== null
      ? `${p.year}-${String(monthNumber(p.month)).padStart(2, '0')}`
      : null;

  // Use exact month match if available, otherwise latest contribution
  const contribution = payslipMonth
    ? (allContributions.find((c) => c.month === payslipMonth) ??
      allContributions.sort((a, b) => b.month.localeCompare(a.month))[0]!)
    : allContributions.sort((a, b) => b.month.localeCompare(a.month))[0]!;

  const findings: FindingInput[] = [];
  const diff = Math.abs(contribution.employee_share - p.pf_deduction);

  if (diff > PAYSLIP_ARITHMETIC_TOLERANCE) {
    findings.push({
      rule_id: 'pf-matches-epfo',
      severity: 'high',
      status: 'open',
      title: 'PF Deduction Does Not Match EPFO Record',
      explanation: `The payslip PF deduction (Rs. ${p.pf_deduction.toLocaleString('en-IN')}) does not match the employee share filed by ${contribution.employerName} in EPFO for ${contribution.month} (Rs. ${contribution.employee_share.toLocaleString('en-IN')}). The employer files EPFO contributions independently.`,
      expected: String(contribution.employee_share),
      observed: String(p.pf_deduction),
      source_document_ids: [],
    });
  }

  return findings;
};

function monthNumber(name: string): number {
  const months: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  return months[name.toLowerCase()] ?? 1;
}
