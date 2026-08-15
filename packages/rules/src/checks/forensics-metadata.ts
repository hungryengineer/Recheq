import type { RuleFunction } from '../check.js';
import type { FindingInput } from '@tieout/schema';

export const checkForensicsMetadata: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_forensics || !ctx.forensics || ctx.forensics.length === 0) {
    return [
      {
        rule_id: 'forensics-metadata',
        severity: 'high',
        status: 'not_assessed',
        title: 'Document Forensics Unverified',
        explanation: 'Forensics analysis data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const findings: FindingInput[] = [];

  for (const record of ctx.forensics) {
    if (record.monetary_anomalies && record.monetary_anomalies.flagged_regions > 0) {
      findings.push({
        rule_id: 'forensics-monetary-anomalies',
        severity: 'high',
        status: 'open',
        title: 'Monetary Regions Altered',
        explanation:
          'Forensic analysis detected potential modifications in monetary value regions.',
        expected: '0 flagged regions',
        observed: `${record.monetary_anomalies.flagged_regions} flagged regions (confidence: ${(record.monetary_anomalies.highest_confidence_anomaly * 100).toFixed(0)}%)`,
        source_document_ids: [],
      });
    }

    if (record.font_runs && record.font_runs.anomalous_characters > 0) {
      findings.push({
        rule_id: 'forensics-font-anomalies',
        severity: 'medium',
        status: 'open',
        title: 'Inconsistent Font Usage',
        explanation:
          'Document contains text rendered with fonts inconsistent with the rest of the document.',
        expected: '0 anomalous characters',
        observed: `${record.font_runs.anomalous_characters} anomalous characters`,
        source_document_ids: [],
      });
    }
  }

  return findings;
};
