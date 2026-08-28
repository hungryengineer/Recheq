import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { calculatePayslipConfidence, calculateForm16Confidence } from '../confidence.js';

export const checkDocumentConfidence: RuleFunction = (ctx) => {
  const findings: FindingInput[] = [];

  if (ctx.assembly.has_payslip && ctx.payslip) {
    const { score, penalties } = calculatePayslipConfidence(ctx);

    if (score < 90) {
      const severity: 'high' | 'medium' = score < 60 ? 'high' : 'medium';

      findings.push({
        rule_id: 'document-confidence',
        severity,
        status: 'open',
        title: 'Payslip Confidence Low',
        explanation: `Payslip confidence score is ${score}%. Penalties: ${penalties.join(', ')}.`,
        expected: 'Confidence >= 90%',
        observed: `${score}%`,
        source_document_ids: [],
      });
    }
  }

  if (ctx.assembly.has_form16 && ctx.form16) {
    const { score, penalties } = calculateForm16Confidence(ctx);

    if (score < 90) {
      const severity: 'high' | 'medium' = score < 60 ? 'high' : 'medium';

      findings.push({
        rule_id: 'document-confidence',
        severity,
        status: 'open',
        title: 'Form-16 Confidence Low',
        explanation: `Form-16 confidence score is ${score}%. Penalties: ${penalties.join(', ')}.`,
        expected: 'Confidence >= 90%',
        observed: `${score}%`,
        source_document_ids: [],
      });
    }
  }

  if (!ctx.assembly.has_payslip && !ctx.assembly.has_form16) {
    return [
      {
        rule_id: 'document-confidence',
        severity: 'low',
        status: 'not_assessed',
        title: 'Confidence Not Assessed',
        explanation: 'No payslip or form-16 available to score.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  return findings;
};
