import type { CheckContext } from './check-context.js';

export interface DocumentConfidence {
  score: number;
  penalties: string[];
}

/**
 * Coerce a raw extraction value into a finite number.
 *
 * Guards against NaN/Infinity leaking through from extractors/persistence
 * (JSON turns NaN into null, but a malformed provider could still surface a
 * non-finite number before the DB round-trip). Non-finite and missing values
 * are treated identically: null.
 */
function num(value: number | null | undefined): number | null {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

export function calculatePayslipConfidence(ctx: CheckContext): DocumentConfidence {
  let score = 100;
  const penalties: string[] = [];
  const { payslip, forensics } = ctx;

  if (!payslip) {
    return { score: 0, penalties: ['Payslip extraction missing'] };
  }

  const gross = num(payslip.gross_salary);
  const net = num(payslip.net_salary);
  const totalDeductions = num(payslip.total_deductions);

  // 1. Completeness Checks
  if (!payslip.pan) {
    score -= 10;
    penalties.push('Missing PAN');
  }
  if (!payslip.uan) {
    score -= 10;
    penalties.push('Missing UAN');
  }
  if (!payslip.employer_name) {
    score -= 10;
    penalties.push('Missing Employer Name');
  }
  if (gross === null) {
    score -= 10;
    penalties.push('Missing Gross Salary');
  }
  if (net === null) {
    score -= 10;
    penalties.push('Missing Net Salary');
  }

  // 2. Plausibility Checks
  if (gross !== null && gross < 0) {
    score -= 10;
    penalties.push('Gross salary is negative');
  }
  if (net !== null && net < 0) {
    score -= 10;
    penalties.push('Net salary is negative');
  }

  // 3. Math Consistency Checks
  // Basic + HRA + Allowances (Gross) - Deductions = Net
  // Skipped when any involved amount is implausible (negative or non-finite);
  // those are already penalized in the plausibility pass above.
  if (gross !== null && gross >= 0 && totalDeductions !== null && net !== null && net >= 0) {
    const mathDelta = Math.abs(gross - totalDeductions - net);
    if (mathDelta > 10) {
      // allow a small rounding threshold
      score -= 30;
      penalties.push('Internal math mismatch (Gross - Deductions != Net)');
    }
  }

  // 4. Forensics Integrity Check
  if (forensics && forensics.length > 0) {
    for (const f of forensics) {
      if (f.font_runs && f.font_runs.anomalous_characters > 0) {
        score -= 40;
        penalties.push('Font anomalies detected');
      }
      if (f.monetary_anomalies && f.monetary_anomalies.flagged_regions > 0) {
        score -= 40;
        penalties.push('Monetary region tampering detected');
      }
    }
  }

  return { score: Math.max(0, score), penalties };
}

export function calculateForm16Confidence(ctx: CheckContext): DocumentConfidence {
  let score = 100;
  const penalties: string[] = [];
  const { form16, forensics } = ctx;

  if (!form16) {
    return { score: 0, penalties: ['Form-16 extraction missing'] };
  }

  const exemptAllowances = num(form16.exempt_allowances);
  const standardDeduction = num(form16.standard_deduction);
  const professionalTax = num(form16.professional_tax);
  const grossTotalIncome = num(form16.gross_total_income);
  const netTaxableSalary = num(form16.net_taxable_salary);

  // 1. Completeness Checks
  if (!form16.employee_pan) {
    score -= 10;
    penalties.push('Missing PAN');
  }
  if (!form16.employer_name) {
    score -= 10;
    penalties.push('Missing Employer Name');
  }
  if (grossTotalIncome === null) {
    score -= 20;
    penalties.push('Missing Gross Income');
  }
  if (netTaxableSalary === null) {
    score -= 10;
    penalties.push('Missing Net Taxable Salary');
  }

  // 2. Plausibility Checks
  const shownComponents: Array<[number, string]> = [];
  if (grossTotalIncome !== null) shownComponents.push([grossTotalIncome, 'Gross income']);
  if (netTaxableSalary !== null) shownComponents.push([netTaxableSalary, 'Net taxable salary']);
  for (const [amount, label] of shownComponents) {
    if (amount < 0) {
      score -= 10;
      penalties.push(`${label} is negative`);
    }
  }

  // 3. Math Consistency
  if (
    grossTotalIncome !== null &&
    grossTotalIncome >= 0 &&
    exemptAllowances !== null &&
    exemptAllowances >= 0 &&
    standardDeduction !== null &&
    standardDeduction >= 0 &&
    professionalTax !== null &&
    professionalTax >= 0 &&
    netTaxableSalary !== null &&
    netTaxableSalary >= 0
  ) {
    const calculatedNet = grossTotalIncome - exemptAllowances - standardDeduction - professionalTax;

    const delta = Math.abs(calculatedNet - netTaxableSalary);
    if (delta > 50) {
      // allow some threshold for rounding/other minor deductions
      score -= 30;
      penalties.push('Internal math mismatch (Gross - Exemptions/Deductions != Net Taxable)');
    }
  }

  // 4. Forensics Integrity Check
  if (forensics && forensics.length > 0) {
    for (const f of forensics) {
      if (f.font_runs && f.font_runs.anomalous_characters > 0) {
        score -= 40;
        penalties.push('Font anomalies detected');
      }
      if (f.monetary_anomalies && f.monetary_anomalies.flagged_regions > 0) {
        score -= 40;
        penalties.push('Monetary region tampering detected');
      }
    }
  }

  return { score: Math.max(0, score), penalties };
}
