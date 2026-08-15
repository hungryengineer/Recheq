import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  disputeFinding,
  type DisputeServiceDeps,
} from '../src/services/findings/dispute-service.js';
import { AppError } from '../src/http/errors.js';

describe('disputeFinding', () => {
  let deps: DisputeServiceDeps;

  beforeEach(() => {
    deps = {
      db: {
        transaction: vi.fn(async (cb) => cb({})),
        getFindingById: vi.fn(),
        updateFindingStatusAndReason: vi.fn().mockResolvedValue(undefined),
      },
      audit: {
        appendEvent: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it('updates finding status to disputed and appends audit event', async () => {
    vi.mocked(deps.db.getFindingById).mockResolvedValueOnce({
      id: 'finding-1',
      case_id: 'case-1',
      status: 'open',
    });

    await disputeFinding('case-1', 'finding-1', 'I never claimed this', deps);

    expect(deps.db.updateFindingStatusAndReason).toHaveBeenCalledWith(
      expect.anything(),
      'finding-1',
      'disputed',
      'I never claimed this',
    );
    expect(deps.audit.appendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        case_id: 'case-1',
        kind: 'finding_disputed',
        payload: {
          finding_id: 'finding-1',
          reason: 'I never claimed this',
        },
        actor: 'candidate',
      }),
    );
  });

  it('throws 404 if finding is not found', async () => {
    vi.mocked(deps.db.getFindingById).mockResolvedValue(null);

    const promise = disputeFinding('case-1', 'finding-1', 'reason', deps);
    await expect(promise).rejects.toThrowError(AppError);
    await expect(promise).rejects.toThrow(/not found/i);
    await expect(promise).rejects.toMatchObject({
      statusCode: 404,
      code: 'FINDING_NOT_FOUND',
    });
  });

  it('throws 403 if finding belongs to a different case', async () => {
    vi.mocked(deps.db.getFindingById).mockResolvedValue({
      id: 'finding-1',
      case_id: 'case-2', // different case
      status: 'open',
    });

    const promise = disputeFinding('case-1', 'finding-1', 'reason', deps);
    await expect(promise).rejects.toThrowError(AppError);
    await expect(promise).rejects.toThrow(/does not belong/i);
    await expect(promise).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('throws 400 if finding is not in open status', async () => {
    vi.mocked(deps.db.getFindingById).mockResolvedValue({
      id: 'finding-1',
      case_id: 'case-1',
      status: 'resolved',
    });

    const promise = disputeFinding('case-1', 'finding-1', 'reason', deps);
    await expect(promise).rejects.toThrowError(AppError);
    await expect(promise).rejects.toThrow(/Cannot dispute/i);
    await expect(promise).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_FINDING_STATUS',
    });
  });
});
