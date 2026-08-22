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

// Eager validation during startup should be called by the host application (e.g. Next.js instrumentation)

export function getSecretKey(): Uint8Array {
  if (!_secretKey) {
    _initSecretKey();
  }
  return _secretKey!;
}

export function _clearSecretKeyForTest() {
  _secretKey = null;
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
