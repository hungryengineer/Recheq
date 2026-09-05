import { describe, expect, it, vi } from 'vitest';
import { EpfoHistoryStep } from '../src/workflows/steps/epfo-history-step.js';
import type { CaseProcessingDeps, CaseStepContext } from '../src/workflows/case-processing.js';
import type { EpfoProvider } from '../src/epfo/epfo-provider.js';
import type { EpfoHistory } from '@recheq/rules';

const SAMPLE_HISTORY: EpfoHistory = {
  uan: '100000000001',
  periods: [
    {
      employerName: 'Acme Pvt Ltd',
      establishmentId: 'KA-BANG-0000001',
      startDate: '2023-04-01',
      endDate: null,
      contributions: [],
    },
  ],
};

/**
 * Deps fixture for the EpfoHistoryStep surface.
 *
 * `db` carries the drizzle client in its real type, so it is narrowed once at
 * this boundary (same pattern as case-processing.integration.test.ts); every
 * member used by the step stays fully typed and TS-checked.
 */
function buildDeps(overrides: {
  uan?: string | null;
  history?: Promise<EpfoHistory | null> | Error;
  failRecordCreationWith?: Error;
}): CaseProcessingDeps {
  const db = {
    getCaseById: vi.fn().mockResolvedValue({
      id: 'case-1',
      uan: overrides.uan === undefined ? '100000000001' : overrides.uan,
      status: 'processing' as const,
    }),
    getConsentByCaseId: vi.fn().mockResolvedValue({ id: 'consent-1' }),
    getDocumentsForCase: vi.fn<(caseId: string) => Promise<never[]>>().mockResolvedValue([]),
    getSuccessfulExtractions: vi
      .fn<(documentIds: string[]) => Promise<never[]>>()
      .mockResolvedValue([]),
    getCompletedEpfoRecords: vi.fn<(caseId: string) => Promise<never[]>>().mockResolvedValue([]),
    getCompletedForensics: vi.fn<(caseId: string) => Promise<never[]>>().mockResolvedValue([]),
    updateCaseStatusAndVerdict: vi
      .fn<(tx: unknown) => Promise<void>>()
      .mockResolvedValue(undefined),
    replaceFindings: vi
      .fn<(tx: unknown, caseId: string, findings: never[]) => Promise<void>>()
      .mockResolvedValue(undefined),
    createPendingRecord:
      overrides.failRecordCreationWith === undefined
        ? vi.fn<(c: string, k: string, u: string) => Promise<string>>().mockResolvedValue('rec-1')
        : vi
            .fn<(c: string, k: string, u: string) => Promise<string>>()
            .mockRejectedValue(overrides.failRecordCreationWith),
    updateRecordSuccess: vi.fn<(id: string, h: EpfoHistory) => Promise<void>>(),
    updateRecordFailure: vi.fn<(id: string, error: string) => Promise<void>>(),
    getDocumentContent: vi
      .fn<(documentId: string) => Promise<{ content: string; mimeType: string }>>()
      .mockResolvedValue({ content: '', mimeType: 'application/pdf' }),
    transaction: vi.fn(<T>(cb: (tx: unknown) => Promise<T>) => cb({})),
  };

  const epfoProvider: EpfoProvider = {
    fetchEmploymentHistory: vi.fn(() => {
      if (overrides.history === undefined) return Promise.resolve(SAMPLE_HISTORY);
      if (overrides.history instanceof Error) return Promise.reject(overrides.history);
      return overrides.history;
    }),
  };

  return {
    db: db as unknown as CaseProcessingDeps['db'],
    audit: { appendEvent: vi.fn<(tx: unknown, input: never) => Promise<never>>() },
    epfoProvider,
    extractor: {
      extractPayslip: vi.fn<() => Promise<never>>(),
      extractForm16: vi.fn<() => Promise<never>>(),
    },
  } as unknown as CaseProcessingDeps;
}

function ctx(deps: CaseProcessingDeps): CaseStepContext {
  return { caseId: 'case-1', deps };
}

describe('EpfoHistoryStep — declared-source availability (R1.16)', () => {
  it('marks not_assessed (never failed) when the source has no history', async () => {
    const result = await new EpfoHistoryStep().run(
      ctx(buildDeps({ history: Promise.resolve(null) })),
    );

    expect(result.state).toBe('not_assessed');
    expect(result.artifact).toBeNull();
    // candidate-safe reason: no internal provider/error text leaks
    expect(result.reason).toBe('Employment history could not be verified right now');
    expect(result.provenance.source).toBe('epfo:signzy');
  });

  it('classifies provider exceptions as source unavailability per BE-11, not step failure', async () => {
    const result = await new EpfoHistoryStep().run(
      ctx(buildDeps({ history: new Error('secret-provider-detail') })),
    );

    // R1.16: unavailable declared source -> not_assessed; BE-11: provider
    // failure causes dependent rules to be not assessed. The internal error
    // must never surface in the candidate-safe reason.
    expect(result.state).toBe('not_assessed');
    expect(result.reason).toBe('Employment history could not be verified right now');
    expect(JSON.stringify(result)).not.toContain('secret-provider-detail');
  });

  it('keeps unexpected persistence faults on the failed path via R1.10', async () => {
    const result = await new EpfoHistoryStep().run(
      ctx(buildDeps({ failRecordCreationWith: new Error('db-write-failed-secret') })),
    );

    expect(result.state).toBe('failed');
    expect(result.reason).toBe('Failed to sync EPFO history');
    expect(result.reason).not.toContain('db-write-failed-secret');
  });

  it('marks not_assessed when no UAN was provided', async () => {
    const result = await new EpfoHistoryStep().run(ctx(buildDeps({ uan: null })));

    expect(result.state).toBe('not_assessed');
    expect(result.reason).toBe('No UAN provided');
  });
});
