import * as fs from 'node:fs';
import * as path from 'node:path';

interface SalaryComponentJson {
  raw_label?: string | null;
  amount?: number | null;
}

interface PayslipFixtureJson {
  employee_name?: string | null;
  employee_id?: string | null;
  employer_name?: string | null;
  month?: string | null;
  year?: number | null;
  basic?: SalaryComponentJson;
  hra?: SalaryComponentJson;
  da?: SalaryComponentJson;
  special_allowance?: SalaryComponentJson;
  other_allowances?: SalaryComponentJson[];
  gross_salary?: number | null;
  pf_deduction?: number | null;
  professional_tax?: number | null;
  income_tax?: number | null;
  other_deductions?: number | null;
  total_deductions?: number | null;
  net_salary?: number | null;
  uan?: string | null;
  pf_account_number?: string | null;
}

interface Form16FixtureJson {
  employee_name?: string | null;
  employee_pan?: string | null;
  employer_name?: string | null;
  employer_tan?: string | null;
  employer_pan?: string | null;
  financial_year?: string | null;
  assessment_year?: string | null;
  gross_total_income?: number | null;
  total_salary?: number | null;
  exempt_allowances?: number | null;
  standard_deduction?: number | null;
  professional_tax?: number | null;
  net_taxable_salary?: number | null;
  total_tax_deducted?: number | null;
  total_tax_deposited?: number | null;
  total_income_tax_payable?: number | null;
}

export interface PayslipRenderData {
  employeeName: string;
  employeeId: string;
  department: string;
  designation: string;
  employerName: string;
  month: string;
  year: number;
  uan: string;
  pfAccount: string;
  earnings: [string, number][];
  deductions: [string, number][];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

export interface Form16RenderData {
  employeeName: string;
  employeePan: string;
  employerName: string;
  employerTan: string;
  employerPan: string;
  financialYear: string;
  assessmentYear: string;
  grossTotalIncome: number | null;
  totalSalary: number | null;
  exemptAllowances: number | null;
  standardDeduction: number | null;
  professionalTax: number | null;
  netTaxableIncome: number | null;
  totalTaxDeducted: number;
  totalTaxDeposited: number;
  totalIncomeTaxPayable: number | null;
  includePartB: boolean;
}

function readFixtureJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function component(label: string, component?: SalaryComponentJson): [string, number] | null {
  if (component?.amount == null) {
    return null;
  }

  return [component.raw_label ?? label, component.amount];
}

export function jsonToPayslipRenderData(json: PayslipFixtureJson): PayslipRenderData {
  const earnings: [string, number][] = [];
  const push = (entry: [string, number] | null) => {
    if (entry) {
      earnings.push(entry);
    }
  };

  push(component('Basic Salary', json.basic));
  push(component('House Rent Allowance', json.hra));
  push(component('Dearness Allowance', json.da));
  push(component('Special Allowance', json.special_allowance));

  for (const allowance of json.other_allowances ?? []) {
    push(component('Allowance', allowance));
  }

  const deductions: [string, number][] = [];
  if (json.pf_deduction != null) {
    deductions.push(['Provident Fund (Employee)', json.pf_deduction]);
  }
  if (json.professional_tax != null) {
    deductions.push(['Professional Tax', json.professional_tax]);
  }
  if (json.income_tax != null) {
    deductions.push(['Income Tax (TDS)', json.income_tax]);
  }
  if (json.other_deductions != null && json.other_deductions > 0) {
    deductions.push(['Other Deductions', json.other_deductions]);
  }

  return {
    employeeName: json.employee_name ?? 'Unknown Employee',
    employeeId: json.employee_id ?? 'EMP-0000',
    department: 'Operations',
    designation: 'Employee',
    employerName: json.employer_name ?? 'Employer Pvt Ltd',
    month: json.month ?? 'January',
    year: json.year ?? 2024,
    uan: json.uan ?? '—',
    pfAccount: json.pf_account_number ?? 'MH/MUM/00000/000/0000',
    earnings,
    deductions,
    grossSalary: json.gross_salary ?? 0,
    totalDeductions: json.total_deductions ?? 0,
    netSalary: json.net_salary ?? 0,
  };
}

export function jsonToForm16RenderData(json: Form16FixtureJson): Form16RenderData {
  const includePartB =
    json.total_salary != null ||
    json.gross_total_income != null ||
    json.net_taxable_salary != null ||
    json.total_income_tax_payable != null;

  return {
    employeeName: json.employee_name ?? 'Unknown Employee',
    employeePan: json.employee_pan ?? 'AAAAA0000A',
    employerName: json.employer_name ?? 'Employer Pvt Ltd',
    employerTan: json.employer_tan ?? 'MUMX00000A',
    employerPan: json.employer_pan ?? 'AAAAA0000A',
    financialYear: json.financial_year ?? '2023-24',
    assessmentYear: json.assessment_year ?? '2024-25',
    grossTotalIncome: json.gross_total_income ?? null,
    totalSalary: json.total_salary ?? null,
    exemptAllowances: json.exempt_allowances ?? null,
    standardDeduction: json.standard_deduction ?? null,
    professionalTax: json.professional_tax ?? null,
    netTaxableIncome: json.net_taxable_salary ?? null,
    totalTaxDeducted: json.total_tax_deducted ?? 0,
    totalTaxDeposited: json.total_tax_deposited ?? 0,
    totalIncomeTaxPayable: json.total_income_tax_payable ?? null,
    includePartB,
  };
}

export function loadPayslipRenderData(fixturePath: string): PayslipRenderData {
  return jsonToPayslipRenderData(readFixtureJson(fixturePath) as PayslipFixtureJson);
}

export function loadForm16RenderData(fixturePath: string): Form16RenderData {
  return jsonToForm16RenderData(readFixtureJson(fixturePath) as Form16FixtureJson);
}

export function listFixtureJsonFiles(fixturesDir: string): string[] {
  return fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith('.json') && !file.startsWith('payslip-template-'))
    .sort();
}

export function fixtureJsonPath(fixturesDir: string, labelFile: string): string {
  return path.join(fixturesDir, labelFile);
}
