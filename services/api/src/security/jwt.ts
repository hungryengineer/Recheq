// Use global crypto.randomUUID() which is standard in Edge and Node runtimes
import { SignJWT, jwtVerify } from 'jose';

let _secretKey: Uint8Array | null = null;

export function _initSecretKey(): void {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing or less than 32 characters. The API refuses to start without a secure secret.',
    );
  }
  _secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
}

function getSecretKey(): Uint8Array {
  if (!_secretKey) {
    _initSecretKey();
  }
  return _secretKey!;
}

export function _clearSecretKeyForTest() {
  _secretKey = null;
}

export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
}

export interface JwtClaims extends JwtPayload {
  /** Unique token id, used for server-side revocation (logout). */
  jti: string;
  /** ISO issued-at timestamp, used for device-cutoff revocation. */
  iat: string;
  /** ISO expiration timestamp. */
  exp: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  const jti = crypto.randomUUID();
  return new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

/**
 * Stateless cryptographic verification. Returns the raw claims (including jti
 * and iat) with no revocation checks — revocation is enforced by
 * verifySessionToken / verifyApiToken which pair this with the denylist.
 */
export async function verifyToken(token: string): Promise<JwtClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const claims = payload as unknown as {
      userId?: unknown;
      orgId?: unknown;
      role?: unknown;
      jti?: unknown;
      iat?: unknown;
      exp?: unknown;
    };
    // Reject malformed payloads outright instead of trusting arbitrary types.
    if (
      typeof claims.userId !== 'string' ||
      typeof claims.orgId !== 'string' ||
      typeof claims.jti !== 'string' ||
      typeof claims.iat !== 'number' ||
      !Number.isFinite(claims.iat) ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp)
    ) {
      return null;
    }
    if (claims.role !== undefined && typeof claims.role !== 'string') {
      return null;
    }
    return {
      userId: claims.userId,
      orgId: claims.orgId,
      role: claims.role ?? 'verifier',
      jti: claims.jti,
      iat: new Date(claims.iat * 1000).toISOString(),
      exp: new Date(claims.exp * 1000).toISOString(),
    };
  } catch (err) {
    console.error('JWT Verify Error:', err);
    return null;
  }
}
