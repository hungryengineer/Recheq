import type { CheckContext } from './check-context.js';

export interface DocumentConfidence {
  score: number;
  penalties: string[];
}

export function calculatePayslipConfidence(ctx: CheckContext): DocumentConfidence {
  let score = 100;
  const penalties: string[] = [];
  const { payslip, forensics } = ctx;

  if (!payslip) {
    return { score: 0, penalties: ['Payslip extraction missing'] };
  }

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
  if (payslip.gross_salary === null) {
    score -= 10;
    penalties.push('Missing Gross Salary');
  }
  if (payslip.net_salary === null) {
    score -= 10;
    penalties.push('Missing Net Salary');
  }

  // 2. Math Consistency Checks
  // Basic + HRA + Allowances (Gross) - Deductions = Net
  if (
    payslip.gross_salary !== null &&
    payslip.total_deductions !== null &&
    payslip.net_salary !== null
  ) {
    const mathDelta = Math.abs(
      payslip.gross_salary - payslip.total_deductions - payslip.net_salary,
    );
    if (mathDelta > 10) {
      // allow a small rounding threshold
      score -= 30;
      penalties.push('Internal math mismatch (Gross - Deductions != Net)');
    }
  }

  // 3. Forensics Integrity Check
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

  // 1. Completeness Checks
  if (!form16.employee_pan) {
    score -= 10;
    penalties.push('Missing PAN');
  }
  if (!form16.employer_name) {
    score -= 10;
    penalties.push('Missing Employer Name');
  }
  if (form16.gross_total_income === null) {
    score -= 20;
    penalties.push('Missing Gross Income');
  }
  if (form16.net_taxable_salary === null) {
    score -= 10;
    penalties.push('Missing Net Taxable Salary');
  }

  // 2. Math Consistency
  if (
    form16.gross_total_income !== null &&
    form16.exempt_allowances !== null &&
    form16.standard_deduction !== null &&
    form16.professional_tax !== null &&
    form16.net_taxable_salary !== null
  ) {
    const calculatedNet =
      form16.gross_total_income -
      form16.exempt_allowances -
      form16.standard_deduction -
      form16.professional_tax;

    const delta = Math.abs(calculatedNet - form16.net_taxable_salary);
    if (delta > 50) {
      // allow some threshold for rounding/other minor deductions
      score -= 30;
      penalties.push('Internal math mismatch (Gross - Exemptions/Deductions != Net Taxable)');
    }
  }

  // 3. Forensics Integrity Check
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
