import { eq, lt, inArray } from 'drizzle-orm';
import { schema } from '../db/client.js';
import type { Database } from '../db/client.js';
import { verifyToken, type JwtClaims } from './jwt.js';

// ─── Session Verification & Revocation ──────────────────────────
// Complements the stateless JWT verification in jwt.ts with the durable
// denylist. Callers that authenticate users (API routes, server actions) must
// use verifySessionToken so revoked/rotated sessions are rejected server-side.

export interface SessionRevocationRepo {
  isRevoked(jti: string): Promise<boolean>;
  getTokenCutoff(userId: string): Promise<Date | null>;
}

export function createSessionRevocationRepo(db: Database): SessionRevocationRepo {
  return {
    async isRevoked(jti) {
      const rows = await db
        .select({ jti: schema.revoked_tokens.jti })
        .from(schema.revoked_tokens)
        .where(eq(schema.revoked_tokens.jti, jti))
        .limit(1);
      return rows.length > 0;
    },

    async getTokenCutoff(userId) {
      const rows = await db
        .select({ token_cutoff_at: schema.users.token_cutoff_at })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      return rows[0]?.token_cutoff_at ?? null;
    },
  };
}

/**
 * Cryptographically verifies the token, then applies the revocation checks:
 *  - the jti must not be in the denylist (logout),
 *  - the token's iat must be at/after the user's token_cutoff_at (password
 *    change / sign-out-all-devices).
 * Returns the claims when the token is valid and not revoked, else null.
 */
export async function verifySessionToken(
  db: Database,
  token: string,
  repoOverride?: SessionRevocationRepo,
): Promise<JwtClaims | null> {
  const claims = await verifyToken(token);
  if (!claims) return null;

  const repo = repoOverride ?? createSessionRevocationRepo(db);
  if (await repo.isRevoked(claims.jti)) {
    return null;
  }

  const cutoff = await repo.getTokenCutoff(claims.userId);
  if (cutoff && new Date(claims.iat).getTime() < cutoff.getTime()) {
    return null;
  }

  return claims;
}

export async function revokeSession(
  db: Database,
  claims: Pick<JwtClaims, 'jti' | 'exp'>,
  reason = 'logout',
  revokedBy?: string,
): Promise<void> {
  await db.insert(schema.revoked_tokens).values({
    jti: claims.jti,
    exp: new Date(claims.exp),
    reason,
    revoked_by: revokedBy ?? null,
  });
}

export async function revokeAllSessionsForUser(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ token_cutoff_at: new Date(), updated_at: new Date() })
    .where(eq(schema.users.id, userId));
}

/** Best-effort prune of denylist rows whose natural expiry has passed. */
export async function pruneRevokedTokens(db: Database, before: Date = new Date()): Promise<number> {
  const rows = await db
    .select({ jti: schema.revoked_tokens.jti })
    .from(schema.revoked_tokens)
    .where(lt(schema.revoked_tokens.exp, before));
  if (rows.length > 0) {
    const ids = rows.map((r) => r.jti);
    await db.delete(schema.revoked_tokens).where(
      // `inArray` imported as needed to keep the dependency surface small.
      inArray(schema.revoked_tokens.jti, ids),
    );
  }
  return rows.length;
}
