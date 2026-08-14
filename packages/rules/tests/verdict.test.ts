import { describe, it, expect } from 'vitest';
import { calculateVerdict } from '../src/verdict.js';
import type { VerdictableFinding } from '../src/verdict.js';

function finding(
  severity: 'high' | 'medium' | 'low',
  status: 'open' | 'disputed' | 'resolved' | 'not_assessed' = 'open',
): VerdictableFinding {
  return { severity, status };
}

describe('calculateVerdict', () => {
  // ─── Rule 1: insufficient evidence ──────────────────────────

  it('returns insufficient_evidence when evidenceOriginCount is 0', () => {
    expect(calculateVerdict([], 0)).toBe('insufficient_evidence');
  });

  it('returns insufficient_evidence when evidenceOriginCount is 1', () => {
    expect(calculateVerdict([finding('high')], 1)).toBe('insufficient_evidence');
  });

  it('returns insufficient_evidence when evidenceOriginCount is 1 even with no findings', () => {
    expect(calculateVerdict([], 1)).toBe('insufficient_evidence');
  });

  // ─── Rule 2: open high → needs_review ───────────────────────

  it('returns needs_review when there are open high findings (2 origins)', () => {
    expect(calculateVerdict([finding('high')], 2)).toBe('needs_review');
  });

  it('returns needs_review with mixed high and medium', () => {
    expect(calculateVerdict([finding('high'), finding('medium'), finding('low')], 3)).toBe(
      'needs_review',
    );
  });

  it('ignores disputed high findings for verdict', () => {
    // High is disputed, only medium is open → verified_with_notes
    expect(calculateVerdict([finding('high', 'disputed'), finding('medium')], 2)).toBe(
      'verified_with_notes',
    );
  });

  // ─── Rule 3: medium without high → verified_with_notes ──────

  it('returns verified_with_notes when only medium open findings exist', () => {
    expect(calculateVerdict([finding('medium')], 2)).toBe('verified_with_notes');
  });

  it('returns verified_with_notes with medium and low', () => {
    expect(calculateVerdict([finding('medium'), finding('low')], 2)).toBe('verified_with_notes');
  });

  // ─── Rule 4: clean → verified ───────────────────────────────

  it('returns verified when no findings at all', () => {
    expect(calculateVerdict([], 2)).toBe('verified');
  });

  it('returns verified when only low-severity open findings', () => {
    expect(calculateVerdict([finding('low'), finding('low')], 2)).toBe('verified');
  });

  it('returns verified when all findings are resolved', () => {
    expect(calculateVerdict([finding('high', 'resolved'), finding('medium', 'resolved')], 2)).toBe(
      'verified',
    );
  });

  it('returns verified when all findings are not_assessed', () => {
    expect(calculateVerdict([finding('high', 'not_assessed')], 2)).toBe('verified');
  });

  // ─── Frozen contract: never returns rejected ────────────────

  it('never returns rejected regardless of input', () => {
    const extremeCases = [
      { findings: [finding('high'), finding('high'), finding('high')], origins: 5 },
      { findings: [finding('high')], origins: 0 },
      { findings: [], origins: 0 },
      {
        findings: [
          finding('high'),
          finding('high'),
          finding('high'),
          finding('medium'),
          finding('medium'),
          finding('low'),
          finding('low'),
          finding('low'),
        ],
        origins: 10,
      },
    ];

    for (const { findings, origins } of extremeCases) {
      const verdict = calculateVerdict(findings, origins);
      expect(verdict).not.toBe('rejected');
    }
  });
});
