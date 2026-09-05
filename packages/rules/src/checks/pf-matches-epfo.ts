import type { FindingInput } from '@recheq/schema';
import type { EpfoPeriod } from '../check-context.js';
import type { RuleFunction } from '../check.js';
import { PAYSLIP_ARITHMETIC_TOLERANCE } from '../constants.js';

/**
 * pf-matches-epfo
 *
 * Compares payslip pf_deduction against the employer-filed employee_share
 * in the EPFO record for the same month and employer.
 *
 * Employer match strategy:
 *   1. Normalise both names (lowercase, collapse whitespace) and check substring.
 *   2. If exactly one period matches → use it.
 *   3. If zero periods match → not_assessed (employer name mismatch or unavailable).
 *   4. If multiple periods match (e.g. dual-employment) → not_assessed to avoid
 *      selecting an arbitrary contribution. Dual-employment is detected separately
 *      by the dual-employment rule.
 *
 * Contribution month match: exact YYYY-MM from payslip month/year fields.
 * Falls back to the latest contribution within the matched period if no exact
 * month is found (e.g. payslip month field is null).
 */
export const checkPfMatchesEpfo: RuleFunction = (ctx) => {
  const NOT_ASSESSED = (reason: string): FindingInput[] => [
    {
      rule_id: 'pf-matches-epfo',
      severity: 'high',
      status: 'not_assessed',
      title: 'PF vs EPFO Match Unverified',
      explanation: reason,
      expected: null,
      observed: null,
      source_document_ids: [],
    },
  ];

  if (!ctx.assembly.has_epfo || !ctx.epfoHistory || !ctx.assembly.has_payslip || !ctx.payslip) {
    return NOT_ASSESSED(
      'Requires both EPFO history with contributions and payslip extraction data.',
    );
  }

  const p = ctx.payslip;

  if (p.pf_deduction === null) {
    return [];
  }

  // ── Employer match ───────────────────────────────────────────────
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const payslipEmployer = normalize(p.employer_name ?? '');

  if (payslipEmployer === '') {
    return NOT_ASSESSED(
      'Payslip does not specify an employer name; cannot match against EPFO records.',
    );
  }

  const matchedPeriods = ctx.epfoHistory.periods.filter((period) => {
    const epfoEmployer = normalize(period.employerName);
    return epfoEmployer.includes(payslipEmployer) || payslipEmployer.includes(epfoEmployer);
  });

  if (matchedPeriods.length === 0) {
    return NOT_ASSESSED(`No EPFO period matches employer name "${p.employer_name ?? 'unknown'}".`);
  }

  if (matchedPeriods.length > 1) {
    return NOT_ASSESSED(
      `Multiple EPFO periods match employer "${p.employer_name ?? 'unknown'}". Cannot determine which contribution to compare (possible dual employment — see dual-employment rule).`,
    );
  }

  const period: EpfoPeriod = matchedPeriods[0]!;
  const contributions = period.contributions ?? [];

  if (contributions.length === 0) {
    return NOT_ASSESSED('EPFO record contains no monthly contribution data.');
  }

  // ── Contribution month match ────────────────────────────────────
  const month = p.month !== null ? monthNumber(p.month) : null;
  const payslipMonth =
    p.year !== null && month !== null ? `${p.year}-${String(month).padStart(2, '0')}` : null;

  const contribution = payslipMonth
    ? (contributions.find((c) => c.month === payslipMonth) ??
      [...contributions].sort((a, b) => b.month.localeCompare(a.month))[0]!)
    : [...contributions].sort((a, b) => b.month.localeCompare(a.month))[0]!;

  // ── Compare ─────────────────────────────────────────────────────
  const findings: FindingInput[] = [];
  const diff = Math.abs(contribution.employee_share - p.pf_deduction);

  if (diff > PAYSLIP_ARITHMETIC_TOLERANCE) {
    findings.push({
      rule_id: 'pf-matches-epfo',
      severity: 'high',
      status: 'open',
      title: 'PF Deduction Does Not Match EPFO Record',
      explanation: `The payslip PF deduction (Rs. ${p.pf_deduction.toLocaleString('en-IN')}) does not match the employee share filed by ${period.employerName} in EPFO for ${contribution.month} (Rs. ${contribution.employee_share.toLocaleString('en-IN')}). The employer files EPFO contributions independently.`,
      expected: String(contribution.employee_share),
      observed: String(p.pf_deduction),
      source_document_ids: [],
    });
  }

  return findings;
};

function monthNumber(name: string): number | null {
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
  return months[name.toLowerCase()] ?? null;
}
