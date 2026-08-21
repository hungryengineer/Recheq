import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
let _secretKey: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (!_secretKey) {
    if (!JWT_SECRET) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is missing. The API refuses to start without it.',
      );
    }
    _secretKey = new TextEncoder().encode(JWT_SECRET);
  }
  return _secretKey;
}

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as JwtPayload;
  } catch (err) {
    console.error('JWT Verify Error:', err);
    return null;
  }
}
