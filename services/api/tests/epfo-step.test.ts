import { describe, expect, it, vi } from 'vitest';
import { EpfoHistoryStep } from '../src/workflows/steps/epfo-history-step.js';
import type { CaseProcessingDeps } from '../src/workflows/case-processing.js';

function buildDeps(overrides: {
  uan?: string | null;
  history?: unknown;
  failRecordCreationWith?: Error;
}): CaseProcessingDeps {
  return {
    db: {
      getCaseById: vi.fn().mockResolvedValue({
        id: 'case-1',
        uan: overrides.uan === undefined ? '100000000001' : overrides.uan,
        status: 'processing',
      }),
      getConsentByCaseId: vi.fn().mockResolvedValue({ id: 'consent-1' }),
      createPendingRecord:
        overrides.failRecordCreationWith === undefined
          ? vi.fn().mockResolvedValue('rec-1')
          : vi.fn().mockRejectedValue(overrides.failRecordCreationWith),
      updateRecordSuccess: vi.fn().mockResolvedValue(undefined),
      updateRecordFailure: vi.fn().mockResolvedValue(undefined),
    } as unknown as CaseProcessingDeps['db'],
    epfoProvider: {
      fetchEmploymentHistory: overrides.history ?? vi.fn().mockResolvedValue({ establishment: {} }),
    } as unknown as CaseProcessingDeps['epfoProvider'],
  } as unknown as CaseProcessingDeps;
}

async function run(deps: CaseProcessingDeps) {
  return new EpfoHistoryStep().run({
    caseId: 'case-1',
    deps,
  } as unknown as Parameters<EpfoHistoryStep['run']>[0]);
}

describe('EpfoHistoryStep — declared-source availability (R1.16)', () => {
  it('marks not_assessed (never failed) when the source has no history', async () => {
    const result = await run(buildDeps({ history: vi.fn().mockResolvedValue(null) }));

    expect(result.state).toBe('not_assessed');
    expect(result.artifact).toBeNull();
    // candidate-safe reason: no internal provider/error text leaks
    expect(result.reason).toBe('Employment history could not be verified right now');
    expect(result.provenance.source).toBe('epfo:signzy');
  });

  it('marks not_assessed when the provider call fails — internal detail stays out of the reason', async () => {
    const result = await run(
      buildDeps({ history: vi.fn().mockRejectedValue(new Error('secret-provider-detail')) }),
    );

    expect(result.state).toBe('not_assessed');
    expect(result.reason).toBe('Employment history could not be verified right now');
    expect(JSON.stringify(result)).not.toContain('secret-provider-detail');
  });

  it('keeps unexpected faults on the failed path via R1.10 with a candidate-safe reason', async () => {
    const result = await run(
      buildDeps({ failRecordCreationWith: new Error('db-write-failed-secret') }),
    );

    expect(result.state).toBe('failed');
    expect(result.reason).toBe('Failed to sync EPFO history');
    expect(result.reason).not.toContain('db-write-failed-secret');
  });

  it('marks not_assessed when no UAN was provided', async () => {
    const result = await run(buildDeps({ uan: null }));

    expect(result.state).toBe('not_assessed');
    expect(result.reason).toBe('No UAN provided');
  });
});
