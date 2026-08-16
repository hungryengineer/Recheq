import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import { eq, and } from 'drizzle-orm';

export async function deleteApiKeyHandler(
  req: { params: Record<string, string>, auth: { orgId: string } },
  deps: { db: Database }
): Promise<{ status: number; body: any }> {
  const id = req.params.id as string;
  
  await deps.db.delete(schema.api_keys)
    .where(and(
      eq(schema.api_keys.id, id),
      eq(schema.api_keys.org_id, req.auth.orgId)
    ));

  return {
    status: 204,
    body: null
  };
}
