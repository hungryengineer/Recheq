import { describe, expect, it, vi, beforeEach } from 'vitest';
import { syncEpfoHistory, type EpfoServiceDeps } from '../src/epfo/epfo-service.js';
import type { EpfoProvider } from '../src/epfo/epfo-provider.js';

describe('EPFO Service with Dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches history and saves successfully', async () => {
    const dbMock = {
      createPendingRecord: vi.fn().mockResolvedValue('rec-123'),
      updateRecordSuccess: vi.fn().mockResolvedValue(undefined),
      updateRecordFailure: vi.fn().mockResolvedValue(undefined),
    };

    const epfoProviderMock: EpfoProvider = {
      fetchEmploymentHistory: vi.fn().mockResolvedValue({ jobs: [] }),
    };

    const deps: EpfoServiceDeps = {
      db: dbMock,
      epfoProvider: epfoProviderMock,
    };

    const recordId = await syncEpfoHistory(deps, 'case-123', 'consent-123', '100000000001');

    expect(recordId).toBe('rec-123');
    expect(dbMock.createPendingRecord).toHaveBeenCalledWith(
      'case-123',
      'consent-123',
      '100000000001',
    );
    expect(epfoProviderMock.fetchEmploymentHistory).toHaveBeenCalledWith(
      '100000000001',
      'consent-123',
    );
    expect(dbMock.updateRecordSuccess).toHaveBeenCalledWith('rec-123', { jobs: [] });
    expect(dbMock.updateRecordFailure).not.toHaveBeenCalled();
  });

  it('saves failure when history is not found', async () => {
    const dbMock = {
      createPendingRecord: vi.fn().mockResolvedValue('rec-123'),
      updateRecordSuccess: vi.fn().mockResolvedValue(undefined),
      updateRecordFailure: vi.fn().mockResolvedValue(undefined),
    };

    const epfoProviderMock: EpfoProvider = {
      fetchEmploymentHistory: vi.fn().mockResolvedValue(null),
    };

    const deps: EpfoServiceDeps = {
      db: dbMock,
      epfoProvider: epfoProviderMock,
    };

    const recordId = await syncEpfoHistory(deps, 'case-123', 'consent-123', '100000000002');

    expect(recordId).toBe('rec-123');
    expect(dbMock.updateRecordFailure).toHaveBeenCalledWith(
      'rec-123',
      'EPFO history not found for UAN',
    );
    expect(dbMock.updateRecordSuccess).not.toHaveBeenCalled();
  });
});
