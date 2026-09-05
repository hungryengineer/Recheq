import { describe, it, expect, vi } from 'vitest';
import { calculateEventHash } from '../src/audit/hash-chain.js';
import { verifyChain, ChainVerificationError } from '../src/audit/verify-chain.js';
import type { IAuditRepository } from '../src/audit/audit-service.js';
import { AuditService } from '../src/audit/audit-service.js';
import type { EventRecord } from '@recheq/schema';

describe('hash-chain', () => {
  it('calculates deterministic hashes ignoring object key order', () => {
    const hash1 = calculateEventHash('prev', 2, 'case_created', { a: 1, b: 2 });
    const hash2 = calculateEventHash('prev', 2, 'case_created', { b: 2, a: 1 });

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('produces different hashes for different sequences or payloads', () => {
    const hashBase = calculateEventHash(null, 1, 'case_created', { foo: 'bar' });
    const hashSeqDiff = calculateEventHash(null, 2, 'case_created', { foo: 'bar' });
    const hashPayloadDiff = calculateEventHash(null, 1, 'case_created', { foo: 'baz' });
    const hashPrevDiff = calculateEventHash('prev', 1, 'case_created', { foo: 'bar' });

    expect(hashBase).not.toBe(hashSeqDiff);
    expect(hashBase).not.toBe(hashPayloadDiff);
    expect(hashBase).not.toBe(hashPrevDiff);
  });
});

describe('AuditService', () => {
  it('appends the first event with seq=1 and prev_hash=null', async () => {
    const mockRepo: IAuditRepository = {
      getLastEvent: vi.fn().mockResolvedValue(null),
      appendEvent: vi.fn().mockResolvedValue(undefined),
      getEvents: vi.fn().mockResolvedValue([]),
    };

    const service = new AuditService(mockRepo);

    const input = {
      case_id: 'case-1',
      kind: 'case_created' as const,
      payload: { status: 'draft' },
      actor: 'system',
    };

    const event = await service.appendEvent('mock-tx', input);

    expect(event.seq).toBe(1);
    expect(event.prev_hash).toBeNull();
    expect(event.hash).toHaveLength(64);
    expect(mockRepo.appendEvent).toHaveBeenCalledWith('mock-tx', event);
  });

  it('appends subsequent events linking to the previous hash and incrementing seq', async () => {
    const lastEvent: EventRecord = {
      id: 'evt-1',
      case_id: 'case-1',
      seq: 1,
      kind: 'case_created',
      payload: {},
      hash: 'abc123hash',
      prev_hash: null,
      actor: 'system',
      created_at: new Date().toISOString(),
    };

    const mockRepo: IAuditRepository = {
      getLastEvent: vi.fn().mockResolvedValue(lastEvent),
      appendEvent: vi.fn().mockResolvedValue(undefined),
      getEvents: vi.fn().mockResolvedValue([lastEvent]),
    };

    const service = new AuditService(mockRepo);

    const input = {
      case_id: 'case-1',
      kind: 'consent_granted' as const,
      payload: { ip: '1.2.3.4' },
      actor: 'user-1',
    };

    const event = await service.appendEvent('mock-tx', input);

    expect(event.seq).toBe(2);
    expect(event.prev_hash).toBe('abc123hash');
    expect(event.hash).toBe(calculateEventHash('abc123hash', 2, 'consent_granted', input.payload));
  });
});

describe('verifyChain', () => {
  const event1: EventRecord = {
    id: 'e1',
    case_id: 'c1',
    seq: 1,
    kind: 'case_created',
    payload: { status: 'draft' },
    actor: 'system',
    prev_hash: null,
    hash: '',
    created_at: new Date().toISOString(),
  };
  event1.hash = calculateEventHash(event1.prev_hash, event1.seq, event1.kind, event1.payload);

  const event2: EventRecord = {
    id: 'e2',
    case_id: 'c1',
    seq: 2,
    kind: 'consent_granted',
    payload: { ip: '1.2.3.4' },
    actor: 'user',
    prev_hash: event1.hash,
    hash: '',
    created_at: new Date().toISOString(),
  };
  event2.hash = calculateEventHash(event2.prev_hash, event2.seq, event2.kind, event2.payload);

  it('passes for a valid chain', () => {
    expect(() => verifyChain([event1, event2])).not.toThrow();
  });

  it('fails if payload is tampered', () => {
    const tampered = { ...event1, payload: { status: 'withdrawn' } }; // hash no longer matches
    expect(() => verifyChain([tampered, event2])).toThrow(ChainVerificationError);
  });

  it('fails if seq is altered', () => {
    const tampered = { ...event2, seq: 3 };
    expect(() => verifyChain([event1, tampered])).toThrow(/Sequence mismatch/);
  });

  it('fails if prev_hash is altered', () => {
    const tampered = { ...event2, prev_hash: 'badhash' };
    expect(() => verifyChain([event1, tampered])).toThrow(/prev_hash mismatch/);
  });
});
