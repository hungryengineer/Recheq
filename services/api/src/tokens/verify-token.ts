import * as crypto from 'node:crypto';
import type { TokenPurpose } from '@tieout/schema';

export interface TokenRecord {
  hash: string;
  case_id: string;
  purpose: TokenPurpose;
  expires_at: string;
}

export class TokenExpiredError extends Error {
  constructor(message: string = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenPurposeError extends Error {
  constructor(message: string = 'Token purpose is invalid for this operation') {
    super(message);
    this.name = 'InvalidTokenPurposeError';
  }
}

export class InvalidTokenError extends Error {
  constructor(message: string = 'Invalid token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

/**
 * Verifies a raw token against its stored record.
 * Validates the hash matches, it hasn't expired, and the purpose matches the required purpose.
 */
export function verifyToken(
  rawToken: string,
  requiredPurpose: TokenPurpose,
  record: TokenRecord | null,
  nowUtcIso: string = new Date().toISOString(),
): void {
  if (!record) {
    throw new InvalidTokenError();
  }

  const computedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  if (computedHash !== record.hash) {
    throw new InvalidTokenError();
  }

  if (nowUtcIso > record.expires_at) {
    throw new TokenExpiredError();
  }

  if (record.purpose !== requiredPurpose) {
    throw new InvalidTokenPurposeError(
      `Expected purpose '${requiredPurpose}', but token has purpose '${record.purpose}'`,
    );
  }
}
