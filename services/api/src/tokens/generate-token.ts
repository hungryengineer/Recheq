import crypto from 'node:crypto';

export interface GeneratedToken {
  /** The plain-text token that should be sent to the user (never stored) */
  rawToken: string;
  /** The SHA-256 hash of the token that should be stored in the database */
  tokenHash: string;
}

/**
 * Generates a cryptographically secure 32-byte random token and its SHA-256 hash.
 * @param prefix Optional prefix for the raw token (e.g. 'tie_')
 */
export function generateToken(prefix: string = ''): GeneratedToken {
  const entropy = crypto.randomBytes(32).toString('base64url');
  const rawToken = `${prefix}${entropy}`;

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  return { rawToken, tokenHash };
}
