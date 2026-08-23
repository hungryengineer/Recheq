import { describe, it, expect } from 'vitest';
import { checkPfImpliesBasic } from '../src/checks/pf-implies-basic.js';
import { checkPfMatchesEpfo } from '../src/checks/pf-matches-epfo.js';
import type { CheckContext } from '../src/check-context.js';

const baseAssembly = {
  case_id: '00000000-0000-0000-0000-000000000001',
  origins: ['payslip', 'epfo'] as ('payslip' | 'form_16' | 'epfo' | 'employer' | 'forensics')[],
  has_payslip: true,
  has_form16: false,
  has_epfo: true,
  has_employer: false,
  has_forensics: false,
};

const cleanPayslip = {
  employee_name: 'Arun Kumar',
  employee_id: 'ACM-2847',
  employer_name: 'Acme Technologies Pvt Ltd',
  month: 'March',
  year: 2026,
  basic: { raw_label: 'Basic Salary', amount: 30000 },
  hra: { raw_label: 'HRA', amount: 12000 },
  da: { raw_label: 'DA', amount: 3000 },
  special_allowance: { raw_label: 'Special', amount: 8000 },
  other_allowances: [{ raw_label: 'Transport', amount: 1600 }],
  gross_salary: 54600,
  pf_deduction: 3600,
  professional_tax: 200,
  income_tax: 4800,
  other_deductions: 0,
  total_deductions: 8600,
  net_salary: 46000,
  uan: '100123456789',
  pf_account_number: 'MH/MUM/12345/000/2847',
  extraction_notes: null,
  schema_version: 'payslip-v1' as const,
  pan: null,
};

const doctoredPayslip = {
  ...cleanPayslip,
  basic: { raw_label: 'Basic Salary', amount: 52000 },
  pf_deduction: 3600,
};

const arunDoctored = {
  uan: '100123456789',
  periods: [
    {
      employerName: 'Acme Technologies Pvt Ltd',
      establishmentId: 'MH/MUM/12345',
      startDate: '2023-04-01',
      endDate: null,
      contributions: [
        { month: '2026-01', employee_share: 3600, employer_share: 3600 },
        { month: '2026-02', employee_share: 3600, employer_share: 3600 },
        { month: '2026-03', employee_share: 1800, employer_share: 1800 },
      ],
    },
  ],
};

const arunClean = {
  uan: '100123456789',
  periods: [
    {
      employerName: 'Acme Technologies Pvt Ltd',
      establishmentId: 'MH/MUM/12345',
      startDate: '2023-04-01',
      endDate: null,
      contributions: [
        { month: '2026-01', employee_share: 3600, employer_share: 3600 },
        { month: '2026-02', employee_share: 3600, employer_share: 3600 },
        { month: '2026-03', employee_share: 3600, employer_share: 3600 },
      ],
    },
  ],
};

const dualEpfo = {
  uan: '100123456799',
  periods: [
    {
      employerName: 'Acme Technologies Pvt Ltd',
      establishmentId: 'MH/MUM/12345',
      startDate: '2025-01-01',
      endDate: null,
      contributions: [{ month: '2026-03', employee_share: 3600, employer_share: 3600 }],
    },
    {
      employerName: 'Acme Technologies Pvt Ltd',
      establishmentId: 'KA/BLR/67890',
      startDate: '2025-10-01',
      endDate: null,
      contributions: [{ month: '2026-03', employee_share: 2400, employer_share: 2400 }],
    },
  ],
};

// ─── pf-implies-basic ────────────────────────────────────────────

describe('pf-implies-basic', () => {
  it('fires on doctored payslip (basic=52000, pf=3600 → implied=30000)', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: doctoredPayslip,
      form16: null,
      epfoHistory: null,
      forensics: null,
    };
    const findings = checkPfImpliesBasic(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule_id).toBe('pf-implies-basic');
    expect(findings[0]!.status).toBe('open');
    expect(findings[0]!.severity).toBe('high');
    expect(findings[0]!.expected).toBe('Rs. 30,000');
    expect(findings[0]!.observed).toBe('Rs. 52,000');
  });

  it('does not fire on clean payslip (basic=30000, pf=3600 → 12% exact)', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: cleanPayslip,
      form16: null,
      epfoHistory: null,
      forensics: null,
    };
    expect(checkPfImpliesBasic(ctx)).toHaveLength(0);
  });

  it('tolerance: basic=10002, pf=1200 → diff=0.24 < 1, does not fire', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: {
        ...cleanPayslip,
        basic: { ...cleanPayslip.basic, amount: 10002 },
        pf_deduction: 1200,
      },
      form16: null,
      epfoHistory: null,
      forensics: null,
    };
    expect(checkPfImpliesBasic(ctx)).toHaveLength(0);
  });

  it('PF cap: basic=25000, pf=1800 → does not fire (capped at wage ceiling)', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: {
        ...cleanPayslip,
        basic: { ...cleanPayslip.basic, amount: 25000 },
        pf_deduction: 1800,
      },
      form16: null,
      epfoHistory: null,
      forensics: null,
    };
    expect(checkPfImpliesBasic(ctx)).toHaveLength(0);
  });

  it('not_assessed when no payslip', () => {
    const ctx: CheckContext = {
      assembly: { ...baseAssembly, has_payslip: false },
      payslip: null,
      form16: null,
      epfoHistory: null,
      forensics: null,
    };
    const findings = checkPfImpliesBasic(ctx);
    expect(findings[0]!.status).toBe('not_assessed');
  });
});

// ─── pf-matches-epfo ─────────────────────────────────────────────

describe('pf-matches-epfo', () => {
  it('fires on doctored: pf=3600, EPFO employee_share=1800 for March 2026', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: doctoredPayslip,
      form16: null,
      epfoHistory: arunDoctored,
      forensics: null,
    };
    const findings = checkPfMatchesEpfo(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule_id).toBe('pf-matches-epfo');
    expect(findings[0]!.status).toBe('open');
    expect(findings[0]!.severity).toBe('high');
    expect(findings[0]!.expected).toBe('1800');
    expect(findings[0]!.observed).toBe('3600');
  });

  it('does not fire on clean: pf=3600, EPFO employee_share=3600', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: cleanPayslip,
      form16: null,
      epfoHistory: arunClean,
      forensics: null,
    };
    expect(checkPfMatchesEpfo(ctx)).toHaveLength(0);
  });

  it('not_assessed when employer name does not match any EPFO period', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: { ...cleanPayslip, employer_name: 'Unknown Corp' },
      form16: null,
      epfoHistory: arunClean,
      forensics: null,
    };
    const findings = checkPfMatchesEpfo(ctx);
    expect(findings[0]!.status).toBe('not_assessed');
  });

  it('not_assessed when employer name is null (empty employer must not match every period)', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: { ...cleanPayslip, employer_name: null },
      form16: null,
      epfoHistory: arunClean,
      forensics: null,
    };
    const findings = checkPfMatchesEpfo(ctx);
    expect(findings[0]!.status).toBe('not_assessed');
    expect(findings).toHaveLength(1);
  });

  it.each(['Feb', '01', 'March!'])(
    'unsupported month %s is not coerced to January (compares latest contribution instead)',
    (month) => {
      const ctx: CheckContext = {
        assembly: baseAssembly,
        payslip: { ...cleanPayslip, month },
        form16: null,
        epfoHistory: arunDoctored,
        forensics: null,
      };
      const findings = checkPfMatchesEpfo(ctx);
      expect(findings).toHaveLength(1);
      expect(findings[0]!.status).toBe('open');
      expect(findings[0]!.expected).toBe('1800');
      expect(findings[0]!.explanation).toContain('2026-03');
    },
  );

  it('not_assessed when multiple EPFO periods match same employer (dual establishment)', () => {
    const ctx: CheckContext = {
      assembly: baseAssembly,
      payslip: cleanPayslip,
      form16: null,
      epfoHistory: dualEpfo,
      forensics: null,
    };
    const findings = checkPfMatchesEpfo(ctx);
    expect(findings[0]!.status).toBe('not_assessed');
  });

  it('not_assessed when no epfo data', () => {
    const ctx: CheckContext = {
      assembly: { ...baseAssembly, has_epfo: false },
      payslip: cleanPayslip,
      form16: null,
      epfoHistory: null,
      forensics: null,
    };
    const findings = checkPfMatchesEpfo(ctx);
    expect(findings[0]!.status).toBe('not_assessed');
  });
});
