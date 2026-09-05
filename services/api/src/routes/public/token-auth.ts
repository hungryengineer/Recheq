import type { TokenPurpose } from '@recheq/schema';
import { AppError } from '../../http/errors.js';
import {
  TokenExpiredError,
  InvalidTokenError,
  InvalidTokenPurposeError,
} from '../../tokens/verify-token.js';

// ─── Token Verifier Interface ───────────────────────────────────
// Minimal interface for token verification in public route handlers.

export interface TokenVerifier {
  verifyAndGetCaseId: (rawToken: string, purpose: TokenPurpose) => Promise<string>;
}

// ─── Token Resolution ───────────────────────────────────────────

/**
 * Verifies a raw token and returns the associated case ID.
 * Maps token-layer errors to HTTP-layer AppErrors:
 *   - TokenExpiredError  → 410 TOKEN_EXPIRED
 *   - InvalidTokenError  → 401 INVALID_TOKEN
 *   - InvalidTokenPurposeError → 403 INVALID_TOKEN_PURPOSE
 */
export async function resolveToken(
  rawToken: string,
  purpose: TokenPurpose,
  verifier: TokenVerifier,
): Promise<string> {
  try {
    return await verifier.verifyAndGetCaseId(rawToken, purpose);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new AppError(410, 'TOKEN_EXPIRED', 'Token has expired');
    }
    if (err instanceof InvalidTokenError) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
    }
    if (err instanceof InvalidTokenPurposeError) {
      throw new AppError(403, 'INVALID_TOKEN_PURPOSE', 'Token purpose mismatch');
    }
    throw err;
  }
}
