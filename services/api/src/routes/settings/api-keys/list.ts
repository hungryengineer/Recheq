import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import { eq } from 'drizzle-orm';

export async function listApiKeysHandler(
  req: { auth: { orgId: string } },
  deps: { db: Database }
): Promise<{ status: number; body: any }> {
  const keys = await deps.db.select({
    id: schema.api_keys.id,
    name: schema.api_keys.name,
    createdAt: schema.api_keys.created_at,
  })
  .from(schema.api_keys)
  .where(eq(schema.api_keys.org_id, req.auth.orgId));

  return {
    status: 200,
    body: keys.map(k => ({
      id: k.id,
      name: k.name,
      createdAt: k.createdAt.toISOString(),
    }))
  };
}
