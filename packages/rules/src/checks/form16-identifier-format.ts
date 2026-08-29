import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';

// Indian identifier formats:
//   PAN: 5 letters + 4 digits + 1 letter, e.g. ABCPS1234F
//   TAN: 4 letters + 5 digits + 1 letter, e.g. MUMC12345B
const PAN_FORMAT = /^[A-Z]{5}\d{4}[A-Z]$/i;
const TAN_FORMAT = /^[A-Z]{4}\d{5}[A-Z]$/i;

export const checkForm16IdentifierFormat: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_form16 || !ctx.form16) {
    return [
      {
        rule_id: 'form16-identifier-format',
        severity: 'medium',
        status: 'not_assessed',
        title: 'Form-16 Identifier Format Unverified',
        explanation: 'Form-16 extraction data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const f = ctx.form16;
  const findings: FindingInput[] = [];

  if (f.employee_pan && !PAN_FORMAT.test(f.employee_pan)) {
    findings.push({
      rule_id: 'form16-identifier-format',
      severity: 'high',
      status: 'open',
      title: 'Employee PAN Format Invalid',
      explanation:
        'The employee PAN printed on the Form 16 does not match the standard 5-letter, 4-digit, 1-letter format.',
      expected: 'Valid PAN format (e.g. ABCPS1234F)',
      observed: f.employee_pan,
      source_document_ids: [],
    });
  }

  if (f.employer_tan && !TAN_FORMAT.test(f.employer_tan)) {
    findings.push({
      rule_id: 'form16-identifier-format',
      severity: 'high',
      status: 'open',
      title: 'Employer TAN Format Invalid',
      explanation:
        'The employer TAN printed on the Form 16 does not match the standard 4-letter, 5-digit, 1-letter format.',
      expected: 'Valid TAN format (e.g. MUMC12345B)',
      observed: f.employer_tan,
      source_document_ids: [],
    });
  }

  if (f.employer_pan && !PAN_FORMAT.test(f.employer_pan)) {
    findings.push({
      rule_id: 'form16-identifier-format',
      severity: 'high',
      status: 'open',
      title: 'Employer PAN Format Invalid',
      explanation:
        'The employer PAN printed on the Form 16 does not match the standard 5-letter, 4-digit, 1-letter format.',
      expected: 'Valid PAN format (e.g. ABCPS1234F)',
      observed: f.employer_pan,
      source_document_ids: [],
    });
  }

  return findings;
};
