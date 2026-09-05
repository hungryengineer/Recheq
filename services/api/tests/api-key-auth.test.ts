import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  authenticateApiKey,
  apiKeyPrefix,
  API_KEY_PREFIX,
  type ApiKeyRepository,
} from '../src/security/api-key-auth.js';

function makeRepo(
  overrides: Partial<ApiKeyRepository> = {},
  candidates: Array<{ id: string; org_id: string; name: string; secret_hash: string }> = [],
): ApiKeyRepository {
  return {
    findCandidatesByPrefix: vi.fn().mockResolvedValue(candidates),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('api-key-auth.ts', () => {
  describe('apiKeyPrefix', () => {
    it('recognises the req_live_ prefix', () => {
      expect(apiKeyPrefix('req_live_abc123')).toBe(API_KEY_PREFIX);
    });

    it('returns null for secrets without the prefix', () => {
      expect(apiKeyPrefix('other_abc')).toBeNull();
      expect(apiKeyPrefix('')).toBeNull();
    });
  });

  describe('authenticateApiKey', () => {
    it('returns null when the secret lacks the expected prefix', async () => {
      const repo = makeRepo();
      const result = await authenticateApiKey(repo, 'not-a-key');
      expect(result).toBeNull();
      expect(repo.findCandidatesByPrefix).not.toHaveBeenCalled();
    });

    it('returns null when no candidate keys exist under the prefix', async () => {
      const repo = makeRepo({ findCandidatesByPrefix: vi.fn().mockResolvedValue([]) });
      const result = await authenticateApiKey(repo, 'req_live_missing');
      expect(result).toBeNull();
    });

    it('returns the key context when the secret matches the stored hash', async () => {
      const secret = 'req_live_supersecret123';
      const hash = await bcrypt.hash(secret, 4);
      const repo = makeRepo({}, [
        { id: 'key-1', org_id: 'org-1', name: 'My ATS', secret_hash: hash },
      ]);

      const result = await authenticateApiKey(repo, secret);
      expect(result).toEqual({ apiKeyId: 'key-1', orgId: 'org-1', name: 'My ATS' });
      expect(repo.findCandidatesByPrefix).toHaveBeenCalledWith(API_KEY_PREFIX);
      expect(repo.recordUsage).toHaveBeenCalledWith('key-1');
    });

    it('returns null when the secret does not match any stored hash', async () => {
      const hash = await bcrypt.hash('req_live_differentsecret', 4);
      const repo = makeRepo({}, [
        { id: 'key-1', org_id: 'org-1', name: 'ATS', secret_hash: hash },
      ]);

      const result = await authenticateApiKey(repo, 'req_live_wrong');
      expect(result).toBeNull();
      expect(repo.recordUsage).not.toHaveBeenCalled();
    });

    it('tries all candidate hashes before giving up', async () => {
      const hashA = await bcrypt.hash('req_live_firstsecret', 4);
      const hashB = await bcrypt.hash('req_live_secondsecret', 4);
      const repo = makeRepo({}, [
        { id: 'key-a', org_id: 'org-1', name: 'A', secret_hash: hashA },
        { id: 'key-b', org_id: 'org-2', name: 'B', secret_hash: hashB },
      ]);

      const result = await authenticateApiKey(repo, 'req_live_secondsecret');
      expect(result).toEqual({ apiKeyId: 'key-b', orgId: 'org-2', name: 'B' });
    });

    it('swallows recordUsage failures rather than failing auth', async () => {
      const secret = 'req_live_oksecret';
      const hash = await bcrypt.hash(secret, 4);
      const unavailable = {
        findCandidatesByPrefix: vi.fn().mockResolvedValue([
          { id: 'key-1', org_id: 'org-1', name: 'ATS', secret_hash: hash },
        ]),
        recordUsage: vi.fn().mockRejectedValue(new Error('db unavailable')),
      };

      const result = await authenticateApiKey(unavailable, secret);
      expect(result).toEqual({ apiKeyId: 'key-1', orgId: 'org-1', name: 'ATS' });
    });
  });
});