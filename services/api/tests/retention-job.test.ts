import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retentionJob, startWorkers, stopWorkers } from '../src/workers/worker.js';
import * as DocumentStorage from '../src/storage/document-storage.js';

// We need to mock drizzle-orm and the webhook db
const updateMock = vi.fn();
const whereMock = vi.fn();
const setMock = vi.fn(() => ({ where: whereMock }));

const selectMock = vi.fn();
const fromMock = vi.fn();
const whereSelectMock = vi.fn();

const deleteObjectMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/db/client.js', () => {
  return {
    schema: {
      cases: { id: 'cases.id', org_id: 'cases.org_id', candidate_name: 'cases.candidate_name', created_at: 'cases.created_at' },
      documents: { id: 'documents.id', storage_path: 'documents.storage_path', case_id: 'documents.case_id' }
    },
    createDb: () => ({
      update: updateMock.mockReturnValue({ set: setMock }),
      select: selectMock.mockReturnValue({ from: fromMock.mockReturnValue({ where: whereSelectMock }) })
    })
  };
});

vi.mock('../src/storage/document-storage.js', () => {
  return {
    createDocumentStorageFromEnv: vi.fn(() => ({
      deleteObject: deleteObjectMock
    }))
  };
});

vi.mock('../src/workflows/pgboss.js', () => ({
  initPgBoss: vi.fn().mockResolvedValue({
    work: vi.fn(),
    stop: vi.fn()
  }),
  getPgBoss: vi.fn().mockResolvedValue({
    stop: vi.fn()
  })
}));

describe('retentionJob', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.RETENTION_PURGE_ENABLED = 'true';
    process.env.RETENTION_THRESHOLD_DAYS = '180';
    process.env.DATABASE_URL = 'postgres://fake';
    
    // Initialize caseWorker so it passes the !caseWorker check
    await startWorkers({} as any);
  });
  
  it('skips execution if RETENTION_PURGE_ENABLED is not true', async () => {
    process.env.RETENTION_PURGE_ENABLED = 'false';
    await retentionJob([{ id: 'job-1' } as any]);
    expect(selectMock).not.toHaveBeenCalled();
  });
  
  it('fetches old cases, deletes documents, and nullifies PII', async () => {
    // Mock the first select (oldCases)
    whereSelectMock.mockResolvedValueOnce([
      { id: 'case-1', org_id: 'org-1' }
    ]);
    
    // Mock the second select (documents for case-1)
    whereSelectMock.mockResolvedValueOnce([
      { id: 'doc-1', storage_path: 'org-1/case-1/doc-1.pdf' },
      { id: 'doc-2', storage_path: 'org-1/case-1/doc-2.pdf' }
    ]);
    
    await retentionJob([{ id: 'job-1' } as any]);
    
    // Assert documents were deleted
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    expect(deleteObjectMock).toHaveBeenCalledWith('org-1/case-1/doc-1.pdf');
    expect(deleteObjectMock).toHaveBeenCalledWith('org-1/case-1/doc-2.pdf');
    
    // Assert PII was nullified
    expect(updateMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith({
      candidate_name: '[REDACTED]',
      candidate_email: '[REDACTED]',
      employer_name: '[REDACTED]',
      title: '[REDACTED]',
      uan: null
    });
    expect(whereMock).toHaveBeenCalled();
  });
});
