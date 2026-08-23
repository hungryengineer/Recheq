import { describe, it, expect } from 'vitest';
import {
  CaseCreateInput,
  CaseRecord,
  DocumentRecord,
  PayslipExtraction,
  FindingRecord,
  ConsentRecord,
  EvidenceAssembly,
  EventRecord,
} from '../src/index.js';

// ─── Helpers ────────────────────────────────────────────────────

const uuid = () => '00000000-0000-4000-a000-000000000000';
const now = () => '2026-01-15T10:30:00Z';

// ─── CaseCreateInput ───────────────────────────────────────────

describe('CaseCreateInput', () => {
  const valid = {
    employer_name: 'Acme Corp',
    candidate_name: 'Jane Doe',
    candidate_email: 'jane@example.com',
    title: 'Employment Verification — Acme Corp',
    claimed_ctc: 1200000,
    employment_start: '2024-01-01',
    employment_end: '2025-12-31',
    uan: '100012345678',
  };

  it('parses a valid case creation input', () => {
    expect(CaseCreateInput.parse(valid)).toEqual(valid);
  });

  it('accepts null UAN', () => {
    const result = CaseCreateInput.parse({ ...valid, uan: null });
    expect(result.uan).toBeNull();
  });

  it('accepts missing UAN (optional)', () => {
    const { uan: _uan, ...rest } = valid;
    const result = CaseCreateInput.parse(rest);
    expect(result.uan).toBeUndefined();
  });

  it('rejects empty employer name', () => {
    expect(() => CaseCreateInput.parse({ ...valid, employer_name: '' })).toThrow();
  });

  it('rejects missing candidate email', () => {
    const { candidate_email: _candidate_email, ...rest } = valid;
    expect(() => CaseCreateInput.parse(rest)).toThrow();
  });

  it('rejects malformed candidate email', () => {
    expect(() => CaseCreateInput.parse({ ...valid, candidate_email: 'not-an-email' })).toThrow();
  });

  it('accepts a candidate email at the 255-character limit', () => {
    const local = `${'a'.repeat(250)}@x.io`;
    expect(local.length).toBe(255);
    expect(CaseCreateInput.parse({ ...valid, candidate_email: local })).toEqual({
      ...valid,
      candidate_email: local,
    });
  });

  it('rejects a candidate email over 255 characters', () => {
    const local = `${'a'.repeat(251)}@x.io`;
    expect(local.length).toBe(256);
    expect(() => CaseCreateInput.parse({ ...valid, candidate_email: local })).toThrow();
  });

  it('rejects negative CTC', () => {
    expect(() => CaseCreateInput.parse({ ...valid, claimed_ctc: -1 })).toThrow();
  });

  it('rejects invalid date format', () => {
    expect(() => CaseCreateInput.parse({ ...valid, employment_start: 'not-a-date' })).toThrow();
  });
});

// ─── CaseRecord ─────────────────────────────────────────────────

describe('CaseRecord', () => {
  it('parses a valid case record', () => {
    const record = {
      id: uuid(),
      org_id: uuid(),
      created_by: uuid(),
      employer_name: 'Acme Corp',
      candidate_name: 'Jane Doe',
      candidate_email: 'jane@example.com',
      title: 'Verification',
      claimed_ctc: 1200000,
      employment_start: '2024-01-01',
      employment_end: '2025-12-31',
      uan: null,
      status: 'draft',
      verdict: null,
      risk_score: null,
      created_at: now(),
      updated_at: now(),
    };
    expect(CaseRecord.parse(record)).toEqual(record);
  });

  it('rejects risk_score above 100', () => {
    expect(() =>
      CaseRecord.parse({
        id: uuid(),
        org_id: uuid(),
        created_by: uuid(),
        employer_name: 'X',
        candidate_name: 'Y',
        candidate_email: 'y@example.com',
        title: 'T',
        claimed_ctc: 100,
        employment_start: '2024-01-01',
        employment_end: '2025-01-01',
        uan: null,
        status: 'complete',
        verdict: 'verified',
        risk_score: 101,
        created_at: now(),
        updated_at: now(),
      }),
    ).toThrow();
  });
});

// ─── DocumentRecord ─────────────────────────────────────────────

describe('DocumentRecord', () => {
  it('parses a valid document', () => {
    const doc = {
      id: uuid(),
      case_id: uuid(),
      kind: 'payslip',
      status: 'pending',
      original_filename: 'payslip_jan.pdf',
      mime_type: 'application/pdf',
      sha256: 'a'.repeat(64),
      size_bytes: 1024,
      storage_path: 'org1/case1/doc1.pdf',
      uploaded_at: now(),
    };
    expect(DocumentRecord.parse(doc)).toEqual(doc);
  });

  it('rejects invalid document kind', () => {
    expect(() =>
      DocumentRecord.parse({
        id: uuid(),
        case_id: uuid(),
        kind: 'resume',
        status: 'pending',
        original_filename: 'f.pdf',
        mime_type: 'application/pdf',
        sha256: 'a'.repeat(64),
        size_bytes: 100,
        storage_path: 'x',
        uploaded_at: now(),
      }),
    ).toThrow();
  });
});

// ─── PayslipExtraction ──────────────────────────────────────────

describe('PayslipExtraction', () => {
  it('accepts all-null numeric fields', () => {
    const extraction = {
      employee_name: 'Jane Doe',
      employee_id: null,
      employer_name: 'Acme',
      month: 'January',
      year: 2025,
      basic: { raw_label: null, amount: null },
      hra: { raw_label: null, amount: null },
      da: { raw_label: null, amount: null },
      special_allowance: { raw_label: null, amount: null },
      other_allowances: [],
      gross_salary: null,
      pf_deduction: null,
      professional_tax: null,
      income_tax: null,
      other_deductions: null,
      total_deductions: null,
      net_salary: null,
      uan: null,
      pf_account_number: null,
      extraction_notes: null,
      schema_version: 'payslip-v1',
      pan: null,
    };
    expect(PayslipExtraction.parse(extraction)).toEqual(extraction);
  });

  it('accepts fully populated extraction', () => {
    const extraction = {
      employee_name: 'Jane Doe',
      employee_id: 'E123',
      employer_name: 'Acme',
      month: 'January',
      year: 2025,
      basic: { raw_label: 'Basic Pay', amount: 50000 },
      hra: { raw_label: 'HRA', amount: 20000 },
      da: { raw_label: 'DA', amount: 5000 },
      special_allowance: { raw_label: 'Special', amount: 10000 },
      other_allowances: [{ raw_label: 'Other', amount: 2000 }],
      gross_salary: 87000,
      pf_deduction: 6000,
      professional_tax: 200,
      income_tax: 5000,
      other_deductions: 1000,
      total_deductions: 12200,
      net_salary: 74800,
      uan: '123456789012',
      pf_account_number: 'PF123',
      extraction_notes: null,
      schema_version: 'payslip-v1',
      pan: null,
    };
    expect(PayslipExtraction.parse(extraction)).toEqual(extraction);
  });
});

// ─── FindingRecord ──────────────────────────────────────────────

describe('FindingRecord', () => {
  it('parses a valid finding', () => {
    const finding = {
      id: uuid(),
      case_id: uuid(),
      rule_id: 'CHK-PAYSLIP-ARITH',
      severity: 'high',
      status: 'open',
      title: 'Payslip arithmetic mismatch',
      explanation: 'Gross ≠ sum of components',
      expected: '87000',
      observed: '90000',
      source_document_ids: [uuid()],
      dispute_reason: null,
      created_at: now(),
      updated_at: now(),
    };
    expect(FindingRecord.parse(finding)).toEqual(finding);
  });

  it('rejects invalid severity', () => {
    expect(() =>
      FindingRecord.parse({
        id: uuid(),
        case_id: uuid(),
        rule_id: 'X',
        severity: 'critical',
        status: 'open',
        title: 'T',
        explanation: 'E',
        expected: null,
        observed: null,
        source_document_ids: [],
        created_at: now(),
        updated_at: now(),
      }),
    ).toThrow();
  });
});

// ─── ConsentRecord ──────────────────────────────────────────────

describe('ConsentRecord', () => {
  it('parses a valid consent', () => {
    const consent = {
      id: uuid(),
      case_id: uuid(),
      status: 'granted',
      consent_text: 'I agree to background verification...',
      consent_version: 'v1.0',
      granted_at: now(),
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      withdrawn_at: null,
      created_at: now(),
    };
    expect(ConsentRecord.parse(consent)).toEqual(consent);
  });
});

// ─── EvidenceAssembly ───────────────────────────────────────────

describe('EvidenceAssembly', () => {
  it('parses a valid evidence assembly', () => {
    const evidence = {
      case_id: uuid(),
      origins: ['payslip', 'form_16'],
      has_payslip: true,
      has_form16: true,
      has_epfo: false,
      has_employer: false,
      has_forensics: false,
    };
    expect(EvidenceAssembly.parse(evidence)).toEqual(evidence);
  });
});

// ─── EventRecord ────────────────────────────────────────────────

describe('EventRecord', () => {
  it('parses a valid audit event', () => {
    const event = {
      id: uuid(),
      case_id: uuid(),
      seq: 1,
      kind: 'case_created',
      payload: { status: 'draft' },
      hash: 'b'.repeat(64),
      prev_hash: null,
      actor: 'system',
      created_at: now(),
    };
    expect(EventRecord.parse(event)).toEqual(event);
  });

  it('rejects seq < 1', () => {
    expect(() =>
      EventRecord.parse({
        id: uuid(),
        case_id: uuid(),
        seq: 0,
        kind: 'case_created',
        payload: {},
        hash: 'b'.repeat(64),
        prev_hash: null,
        actor: 'system',
        created_at: now(),
      }),
    ).toThrow();
  });

  it('rejects invalid hash length', () => {
    expect(() =>
      EventRecord.parse({
        id: uuid(),
        case_id: uuid(),
        seq: 1,
        kind: 'case_created',
        payload: {},
        hash: 'short',
        prev_hash: null,
        actor: 'system',
        created_at: now(),
      }),
    ).toThrow();
  });
});
