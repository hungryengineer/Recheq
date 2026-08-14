import { describe, it, expect } from 'vitest';
import { calculateRiskScore, getScoreBreakdown } from '../src/score.js';
import type { ScorableFinding } from '../src/score.js';

function finding(
  severity: 'high' | 'medium' | 'low',
  status: 'open' | 'disputed' | 'resolved' | 'not_assessed' = 'open',
): ScorableFinding {
  return { severity, status };
}

describe('calculateRiskScore', () => {
  it('returns 0 for no findings', () => {
    expect(calculateRiskScore([])).toBe(0);
  });

  it('returns 0 when all findings are non-open', () => {
    expect(
      calculateRiskScore([
        finding('high', 'disputed'),
        finding('medium', 'resolved'),
        finding('low', 'not_assessed'),
      ]),
    ).toBe(0);
  });

  it('calculates 40 for one open high finding', () => {
    expect(calculateRiskScore([finding('high')])).toBe(40);
  });

  it('calculates 15 for one open medium finding', () => {
    expect(calculateRiskScore([finding('medium')])).toBe(15);
  });

  it('calculates 5 for one open low finding', () => {
    expect(calculateRiskScore([finding('low')])).toBe(5);
  });

  it('sums mixed severities: 40 + 15 + 5 = 60', () => {
    expect(calculateRiskScore([finding('high'), finding('medium'), finding('low')])).toBe(60);
  });

  it('caps at 100 (3 high = 120 → 100)', () => {
    expect(calculateRiskScore([finding('high'), finding('high'), finding('high')])).toBe(100);
  });

  it('caps at 100 with many findings', () => {
    expect(
      calculateRiskScore([
        finding('high'),
        finding('high'),
        finding('medium'),
        finding('medium'),
        finding('low'),
        finding('low'),
        finding('low'),
      ]),
    ).toBe(100);
  });

  it('ignores disputed and resolved findings', () => {
    expect(
      calculateRiskScore([
        finding('high', 'open'),
        finding('high', 'disputed'),
        finding('medium', 'resolved'),
      ]),
    ).toBe(40); // only the open high counts
  });

  it('handles 2 high + 1 medium = 95', () => {
    expect(calculateRiskScore([finding('high'), finding('high'), finding('medium')])).toBe(95);
  });
});

describe('getScoreBreakdown', () => {
  it('provides detailed breakdown', () => {
    const result = getScoreBreakdown([
      finding('high'),
      finding('medium'),
      finding('medium'),
      finding('low'),
      finding('high', 'disputed'),
    ]);
    expect(result).toEqual({
      high: 1,
      medium: 2,
      low: 1,
      raw: 75, // 40 + 30 + 5
      capped: 75,
    });
  });

  it('shows raw vs capped when exceeding 100', () => {
    const result = getScoreBreakdown([finding('high'), finding('high'), finding('high')]);
    expect(result.raw).toBe(120);
    expect(result.capped).toBe(100);
  });
});
