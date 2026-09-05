import {
  FailureMode,
  type EvaluationResult,
  type Failure,
} from '../../services/api/src/extraction/evaluator.js';

export interface DocumentEvaluationRow {
  document: string;
  precision: number;
  recall: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  failureCounts: Record<FailureMode, number>;
  promptTokens: number;
  completionTokens: number;
}

export interface EvaluationReport {
  documents: DocumentEvaluationRow[];
  overallPrecision: number;
  overallRecall: number;
  totalTruePositives: number;
  totalFalsePositives: number;
  totalFalseNegatives: number;
  failureCounts: Record<FailureMode, number>;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  averagePromptTokens: number;
  averageCompletionTokens: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

const EMPTY_FAILURE_COUNTS: Record<FailureMode, number> = {
  [FailureMode.MISSING_FIELD]: 0,
  [FailureMode.HALLUCINATED_FIELD]: 0,
  [FailureMode.VALUE_MISMATCH]: 0,
  [FailureMode.TYPE_MISMATCH]: 0,
};

export function countFailuresByMode(failures: Failure[]): Record<FailureMode, number> {
  const counts: Record<FailureMode, number> = { ...EMPTY_FAILURE_COUNTS };

  for (const failure of failures) {
    counts[failure.mode] += 1;
  }

  return counts;
}

export function aggregateTokenUsage(usages: TokenUsage[]): {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  averagePromptTokens: number;
  averageCompletionTokens: number;
} {
  const totalPromptTokens = usages.reduce((sum, usage) => sum + usage.promptTokens, 0);
  const totalCompletionTokens = usages.reduce((sum, usage) => sum + usage.completionTokens, 0);
  const count = usages.length || 1;

  return {
    totalPromptTokens,
    totalCompletionTokens,
    averagePromptTokens: totalPromptTokens / count,
    averageCompletionTokens: totalCompletionTokens / count,
  };
}

export function buildEvaluationReport(rows: DocumentEvaluationRow[]): EvaluationReport {
  const totalTruePositives = rows.reduce((sum, row) => sum + row.truePositives, 0);
  const totalFalsePositives = rows.reduce((sum, row) => sum + row.falsePositives, 0);
  const totalFalseNegatives = rows.reduce((sum, row) => sum + row.falseNegatives, 0);

  const overallPrecision =
    totalTruePositives + totalFalsePositives > 0
      ? totalTruePositives / (totalTruePositives + totalFalsePositives)
      : 0;
  const overallRecall =
    totalTruePositives + totalFalseNegatives > 0
      ? totalTruePositives / (totalTruePositives + totalFalseNegatives)
      : 0;

  const failureCounts = { ...EMPTY_FAILURE_COUNTS };
  for (const row of rows) {
    for (const mode of Object.values(FailureMode)) {
      failureCounts[mode] += row.failureCounts[mode];
    }
  }

  const tokenTotals = aggregateTokenUsage(
    rows.map((row) => ({
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
    })),
  );

  return {
    documents: rows,
    overallPrecision,
    overallRecall,
    totalTruePositives,
    totalFalsePositives,
    totalFalseNegatives,
    failureCounts,
    ...tokenTotals,
  };
}

export function rowFromEvaluation(
  document: string,
  evaluation: EvaluationResult,
  usage: TokenUsage = { promptTokens: 0, completionTokens: 0 },
): DocumentEvaluationRow {
  return {
    document,
    precision: evaluation.precision,
    recall: evaluation.recall,
    truePositives: evaluation.truePositives,
    falsePositives: evaluation.falsePositives,
    falseNegatives: evaluation.falseNegatives,
    failureCounts: countFailuresByMode(evaluation.failures),
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatEvaluationReport(report: EvaluationReport): string {
  const lines: string[] = [
    '# Extraction Evaluation Results',
    '',
    'Measured by `pnpm evaluate` against the labelled extraction corpus.',
    'Precision and recall are reported separately — hallucinated fields are more dangerous than missing ones.',
    '',
    '## Aggregate Metrics',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Documents evaluated | ${report.documents.length} |`,
    `| Overall precision | ${pct(report.overallPrecision)} |`,
    `| Overall recall | ${pct(report.overallRecall)} |`,
    `| True positives | ${report.totalTruePositives} |`,
    `| False positives | ${report.totalFalsePositives} |`,
    `| False negatives | ${report.totalFalseNegatives} |`,
    `| Avg input tokens / doc | ${report.averagePromptTokens.toFixed(0)} |`,
    `| Avg output tokens / doc | ${report.averageCompletionTokens.toFixed(0)} |`,
    '',
    '## Failure Modes',
    '',
    '| Failure mode | Count |',
    '| --- | --- |',
    ...Object.values(FailureMode).map((mode) => `| ${mode} | ${report.failureCounts[mode]} |`),
    '',
    '## Per-Document Breakdown',
    '',
    '| Document | Precision | Recall | MISSING | HALLUCINATED | VALUE_MISMATCH | TYPE_MISMATCH | Input tokens | Output tokens |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const row of report.documents) {
    lines.push(
      `| ${row.document} | ${pct(row.precision)} | ${pct(row.recall)} | ${row.failureCounts[FailureMode.MISSING_FIELD]} | ${row.failureCounts[FailureMode.HALLUCINATED_FIELD]} | ${row.failureCounts[FailureMode.VALUE_MISMATCH]} | ${row.failureCounts[FailureMode.TYPE_MISMATCH]} | ${row.promptTokens} | ${row.completionTokens} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function formatTokenSummary(report: EvaluationReport): string {
  return JSON.stringify(
    {
      documentCount: report.documents.length,
      averagePromptTokens: Math.round(report.averagePromptTokens),
      averageCompletionTokens: Math.round(report.averageCompletionTokens),
      totalPromptTokens: report.totalPromptTokens,
      totalCompletionTokens: report.totalCompletionTokens,
    },
    null,
    2,
  );
}
