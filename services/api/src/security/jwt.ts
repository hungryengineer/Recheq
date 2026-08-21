/* eslint-disable @typescript-eslint/no-explicit-any */
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is missing. The API refuses to start without it.',
  );
}
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as JwtPayload;
  } catch (err) {
    console.error('JWT Verify Error:', err);
    return null;
  }
}
