import { describe, expect, it, vi, beforeEach } from 'vitest';
import { syncEpfoHistory } from '../src/epfo/epfo-service.js';
import type { Database } from '../src/db/client.js';

describe('EPFO Service and Fixture Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches clean history fixture for UAN 100000000001', async () => {
    const dbMock = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'rec-123' }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
    } as unknown as Database;

    const recordId = await syncEpfoHistory(dbMock, 'case-123', 'consent-123', '100000000001');
    expect(recordId).toBe('rec-123');
    expect(dbMock.insert).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled();
  });
});
