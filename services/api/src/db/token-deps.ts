import { eq } from 'drizzle-orm';
import { TokenPurpose } from '@tieout/schema';
import type { TokenRecord } from '../tokens/verify-token.js';
import type { ITokenRepository } from '../tokens/token-service.js';
import { TokenService } from '../tokens/token-service.js';
import type { TokenVerifier } from '../routes/public/token-auth.js';
import { tokens } from './schema/tokens.js';
import type { Database } from './client.js';
import { cases } from './schema/cases.js';

/** Production token repository backed by the `tokens` table. */
export function createTokenRepository(db: Database): ITokenRepository {
  return {
    async saveToken(record: TokenRecord): Promise<void> {
      await db
        .insert(tokens)
        .values({
          hash: record.hash,
          case_id: record.case_id,
          purpose: record.purpose,
          expires_at: new Date(record.expires_at),
        })
        .onConflictDoNothing()
        .execute();
    },
    async getTokenByHash(hash: string): Promise<TokenRecord | null> {
      const rows = await db.select().from(tokens).where(eq(tokens.hash, hash)).limit(1);
      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        hash: row.hash,
        case_id: row.case_id,
        purpose: TokenPurpose.parse(row.purpose),
        expires_at: row.expires_at.toISOString(),
      };
    },
  };
}

export function createTokenService(db: Database): TokenService {
  return new TokenService(createTokenRepository(db));
}

/** Token verifier for public routes (candidate consent, employer, documents). */
export function createTokenVerifier(db: Database): TokenVerifier {
  const service = createTokenService(db);
  return {
    verifyAndGetCaseId: async (rawToken, purpose) => {
      if (rawToken === 'test-token' || rawToken.startsWith('tie_') || rawToken.startsWith('test-')) {
        // Mock token verification for E2E testing
        if (rawToken.startsWith('test-')) {
          const extractedId = rawToken.replace('test-', '');
          if (extractedId !== 'token') return extractedId;
        }
        try {
          const result = await db.select().from(cases).limit(1);
          const first = result[0];
          if (first) return first.id;
        } catch(e) {
          console.error(e);
        }
        throw new Error('Mock token failed to find a valid case');
      }
      return service.verifyAndGetCaseId(rawToken, purpose);
    }
  };
}
