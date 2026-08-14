import { describe, it, expect } from 'vitest';
import {
  CaseStatus,
  Verdict,
  FindingSeverity,
  FindingStatus,
  DocumentKind,
  DocumentStatus,
  ConsentStatus,
  TokenPurpose,
  EventKind,
} from '../src/enums.js';

describe('CaseStatus', () => {
  it('accepts all valid case statuses', () => {
    const valid = [
      'draft', 'awaiting_consent', 'awaiting_documents',
      'processing', 'awaiting_employer', 'complete', 'withdrawn',
    ];
    for (const v of valid) {
      expect(CaseStatus.parse(v)).toBe(v);
    }
  });

  it('rejects invalid case status', () => {
    expect(() => CaseStatus.parse('cancelled')).toThrow();
    expect(() => CaseStatus.parse('')).toThrow();
    expect(() => CaseStatus.parse(123)).toThrow();
  });
});

describe('Verdict', () => {
  it('accepts all valid verdicts', () => {
    const valid = [
      'verified', 'verified_with_notes', 'needs_review', 'insufficient_evidence',
    ];
    for (const v of valid) {
      expect(Verdict.parse(v)).toBe(v);
    }
  });

  it('does NOT accept "rejected" — frozen contract', () => {
    expect(() => Verdict.parse('rejected')).toThrow();
  });

  it('rejects other invalid values', () => {
    expect(() => Verdict.parse('approved')).toThrow();
    expect(() => Verdict.parse('')).toThrow();
  });
});

describe('FindingSeverity', () => {
  it('accepts high, medium, low', () => {
    expect(FindingSeverity.parse('high')).toBe('high');
    expect(FindingSeverity.parse('medium')).toBe('medium');
    expect(FindingSeverity.parse('low')).toBe('low');
  });

  it('rejects invalid severity', () => {
    expect(() => FindingSeverity.parse('critical')).toThrow();
  });
});

describe('FindingStatus', () => {
  it('accepts open, disputed, resolved, not_assessed', () => {
    const valid = ['open', 'disputed', 'resolved', 'not_assessed'];
    for (const v of valid) {
      expect(FindingStatus.parse(v)).toBe(v);
    }
  });

  it('rejects invalid status', () => {
    expect(() => FindingStatus.parse('closed')).toThrow();
  });
});

describe('DocumentKind', () => {
  it('accepts payslip and form_16', () => {
    expect(DocumentKind.parse('payslip')).toBe('payslip');
    expect(DocumentKind.parse('form_16')).toBe('form_16');
  });

  it('rejects invalid document kind', () => {
    expect(() => DocumentKind.parse('offer_letter')).toThrow();
  });
});

describe('DocumentStatus', () => {
  it('accepts all valid statuses', () => {
    const valid = ['pending', 'processing', 'extracted', 'failed'];
    for (const v of valid) {
      expect(DocumentStatus.parse(v)).toBe(v);
    }
  });
});

describe('ConsentStatus', () => {
  it('accepts pending, granted, withdrawn', () => {
    const valid = ['pending', 'granted', 'withdrawn'];
    for (const v of valid) {
      expect(ConsentStatus.parse(v)).toBe(v);
    }
  });
});

describe('TokenPurpose', () => {
  it('accepts consent and employer', () => {
    expect(TokenPurpose.parse('consent')).toBe('consent');
    expect(TokenPurpose.parse('employer')).toBe('employer');
  });

  it('rejects invalid purpose', () => {
    expect(() => TokenPurpose.parse('admin')).toThrow();
  });
});

describe('EventKind', () => {
  it('accepts known event kinds', () => {
    const sample = ['case_created', 'consent_granted', 'document_uploaded', 'verdict_calculated'];
    for (const v of sample) {
      expect(EventKind.parse(v)).toBe(v);
    }
  });

  it('rejects unknown event kind', () => {
    expect(() => EventKind.parse('user_logged_in')).toThrow();
  });
});
