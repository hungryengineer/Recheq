import { AppError } from '../../../http/errors.js';
import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function createApiKeyHandler(
  req: { body: unknown, auth: { orgId: string } },
  deps: { db: Database }
): Promise<{ status: number; body: any }> {
  const body = req.body as { name?: string };
  if (!body.name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'API Key name is required');
  }

  const rawSecret = crypto.randomBytes(32).toString('base64url');
  const prefix = 'req_live_';
  const fullSecret = `${prefix}${rawSecret}`;
  
  const secretHash = await bcrypt.hash(fullSecret, 10);

  const [apiKey] = await deps.db.insert(schema.api_keys).values({
    org_id: req.auth.orgId,
    name: body.name,
    prefix,
    secret_hash: secretHash,
  }).returning();

  if (!apiKey) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create API key');

  return {
    status: 201,
    body: {
      id: apiKey.id,
      name: apiKey.name,
      createdAt: apiKey.created_at.toISOString(),
      fullSecret, // Only returned once
    }
  };
}
