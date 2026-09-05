import { describe, expect, it } from 'vitest';
import { FailureMode, evaluateExtraction } from '../../services/api/src/extraction/evaluator.js';
import {
  aggregateTokenUsage,
  buildEvaluationReport,
  formatEvaluationReport,
  rowFromEvaluation,
} from '../lib/evaluation-report.js';

describe('evaluation-report', () => {
  it('buildReport separates precision and recall (never blended)', () => {
    const perfect = evaluateExtraction(
      { name: 'Priya', city: 'Mumbai' },
      { name: 'Priya', city: 'Mumbai' },
    );
    const hallucinated = evaluateExtraction(
      { name: 'Priya', city: 'Mumbai', role: 'Engineer' },
      { name: 'Priya', city: 'Mumbai', role: 'Engineer', bonus: 1, perk: 2, extra: 3 },
    );
    const missing = evaluateExtraction(
      { name: 'Priya', city: 'Mumbai', age: 30, team: 'Platform' },
      { name: 'Priya', city: 'Mumbai' },
    );

    const report = buildEvaluationReport([
      rowFromEvaluation('perfect.json', perfect),
      rowFromEvaluation('hallucinated.json', hallucinated),
      rowFromEvaluation('missing.json', missing),
    ]);

    expect(report.overallPrecision).toBeLessThan(1);
    expect(report.overallRecall).toBeLessThan(1);
    expect(report.overallPrecision).not.toBe(report.overallRecall);
    expect(report.overallPrecision).toBeLessThan(report.overallRecall);
  });

  it('buildReport counts all four FailureMode values independently', () => {
    const evaluation = evaluateExtraction(
      {
        name: 'Priya',
        basic: { amount: 100, raw_label: 'Basic' },
        age: 30,
      },
      {
        name: 'Riya',
        basic: { amount: '100', raw_label: 'Basic' },
        bonus: 500,
      },
    );

    const report = buildEvaluationReport([rowFromEvaluation('sample.json', evaluation)]);

    expect(report.failureCounts[FailureMode.VALUE_MISMATCH]).toBeGreaterThan(0);
    expect(report.failureCounts[FailureMode.MISSING_FIELD]).toBeGreaterThan(0);
    expect(report.failureCounts[FailureMode.HALLUCINATED_FIELD]).toBeGreaterThan(0);
    expect(report.failureCounts[FailureMode.TYPE_MISMATCH]).toBeGreaterThan(0);
  });

  it('buildReport includes per-document rows with precision, recall, failure breakdown', () => {
    const evaluation = evaluateExtraction({ name: 'Priya' }, { name: 'Priya' });
    const report = buildEvaluationReport([
      rowFromEvaluation('payslip-clean-01.json', evaluation, {
        promptTokens: 1200,
        completionTokens: 300,
      }),
    ]);

    expect(report.documents).toHaveLength(1);
    expect(report.documents[0]?.precision).toBe(1);
    expect(report.documents[0]?.recall).toBe(1);
    expect(report.documents[0]?.promptTokens).toBe(1200);
    expect(formatEvaluationReport(report)).toContain('Overall precision');
    expect(formatEvaluationReport(report)).toContain('HALLUCINATED_FIELD');
  });

  it('aggregateTokenUsage sums promptTokens and completionTokens across results', () => {
    const totals = aggregateTokenUsage([
      { promptTokens: 1000, completionTokens: 100 },
      { promptTokens: 2000, completionTokens: 200 },
    ]);

    expect(totals.totalPromptTokens).toBe(3000);
    expect(totals.totalCompletionTokens).toBe(300);
    expect(totals.averagePromptTokens).toBe(1500);
    expect(totals.averageCompletionTokens).toBe(150);
  });
});
