import type { TokenPurpose } from '@tieout/schema';
import { generateToken } from './generate-token.js';
import type { TokenRecord } from './verify-token.js';
import { verifyToken } from './verify-token.js';

export interface ITokenRepository {
  saveToken(record: TokenRecord): Promise<void>;
  getTokenByHash(hash: string): Promise<TokenRecord | null>;
}

export class TokenService {
  constructor(private readonly repo: ITokenRepository) {}

  /**
   * Generates a new purpose-bound token, saves its hash, and returns the raw token string.
   */
  async createToken(caseId: string, purpose: TokenPurpose, expiresInMs: number): Promise<string> {
    const { rawToken, tokenHash } = generateToken('tie_');

    const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

    const record: TokenRecord = {
      hash: tokenHash,
      case_id: caseId,
      purpose,
      expires_at: expiresAt,
    };

    await this.repo.saveToken(record);
    return rawToken;
  }

  /**
   * Verifies a raw token against the given purpose, throws on failure, returns the case ID on success.
   */
  async verifyAndGetCaseId(rawToken: string, purpose: TokenPurpose): Promise<string> {
    const { tokenHash } = await this.hashOnly(rawToken);
    const record = await this.repo.getTokenByHash(tokenHash);

    verifyToken(rawToken, purpose, record);

    return record!.case_id; // Safe because verifyToken throws if record is null
  }

  private async hashOnly(rawToken: string) {
    const { createHash } = await import('node:crypto');
    return { tokenHash: createHash('sha256').update(rawToken).digest('hex') };
  }
}
