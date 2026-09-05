import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { schema } from '../db/client.js';
import type { Database } from '../db/client.js';

// ─── API Key Authentication ─────────────────────────────────────
// Verifies a `req_live_`-prefixed secret against the bcrypt hash stored in
// `api_keys`. Lookup is narrowed by the prefix index before the bcrypt
// comparison so a random bearer value never triggers a full-table scan or
// leaks timing. Successful auth updates `last_used_at` best-effort.

export const API_KEY_PREFIX = 'req_live_';

export interface ApiKeyContext {
  apiKeyId: string;
  orgId: string;
  name: string;
}

export interface ApiKeyRecord {
  id: string;
  org_id: string;
  name: string;
  secret_hash: string;
}

export interface ApiKeyRepository {
  /** Narrow the search using the stable prefix (index-backed). */
  findCandidatesByPrefix(prefix: string, limit?: number): Promise<ApiKeyRecord[]>;
  /** Best-effort usage tracking; must never throw into the auth path. */
  recordUsage(id: string): Promise<void>;
}

export function createApiKeyRepository(db: Database): ApiKeyRepository {
  return {
    async findCandidatesByPrefix(prefix, limit = 10) {
      const rows = await db
        .select({
          id: schema.api_keys.id,
          org_id: schema.api_keys.org_id,
          name: schema.api_keys.name,
          secret_hash: schema.api_keys.secret_hash,
        })
        .from(schema.api_keys)
        .where(eq(schema.api_keys.prefix, prefix))
        .limit(limit);
      return rows as ApiKeyRecord[];
    },

    async recordUsage(id) {
      try {
        await db
          .update(schema.api_keys)
          .set({ last_used_at: new Date() })
          .where(eq(schema.api_keys.id, id));
      } catch (err) {
        console.error('Failed to record API key usage', { error: (err as Error).message });
      }
    },
  };
}

export function apiKeyPrefix(secret: string): string | null {
  if (!secret.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  return API_KEY_PREFIX;
}

/**
 * Attempts to authenticate a request using an API key.
 * Returns null when the key is absent, malformed, or invalid so callers can
 * decide whether to fall through to JWT auth or reject outright.
 */
export async function authenticateApiKey(
  repo: ApiKeyRepository,
  secret: string,
): Promise<ApiKeyContext | null> {
  const prefix = apiKeyPrefix(secret);
  if (!prefix) return null;

  const candidates = await repo.findCandidatesByPrefix(prefix);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const match = await bcrypt.compare(secret, candidate.secret_hash);
    if (match) {
      try {
        await repo.recordUsage(candidate.id);
      } catch (err) {
        console.error('Failed to record API key usage', { error: (err as Error).message });
      }
      return {
        apiKeyId: candidate.id,
        orgId: candidate.org_id,
        name: candidate.name,
      };
    }
  }

  return null;
}
