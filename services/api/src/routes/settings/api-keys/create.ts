import { AppError } from '../../../http/errors.js';
import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { API_KEY_PREFIX } from '../../../security/api-key-auth.js';

export async function createApiKeyHandler(
  req: { body: unknown; auth: { orgId: string } },
  deps: { db: Database },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any }> {
  const body = req.body as { name?: string };
  if (!body.name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'API Key name is required');
  }

  const rawSecret = crypto.randomBytes(32).toString('base64url');
  const prefix = API_KEY_PREFIX; // 'req_live_'
  const fullSecret = `${prefix}${rawSecret}`;
  // Persist a unique per-key lookup fragment (first 20 chars of the full
  // secret) so auth narrows to exactly one row before the bcrypt comparison,
  // regardless of how many keys exist.
  const lookupFragment = fullSecret.slice(0, 20);

  const secretHash = await bcrypt.hash(fullSecret, 10);

  const [apiKey] = await deps.db
    .insert(schema.api_keys)
    .values({
      org_id: req.auth.orgId,
      name: body.name,
      prefix: lookupFragment,
      secret_hash: secretHash,
    })
    .returning();

  if (!apiKey) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create API key');

  return {
    status: 201,
    body: {
      id: apiKey.id,
      name: apiKey.name,
      createdAt: apiKey.created_at.toISOString(),
      fullSecret, // Only returned once
    },
  };
}
