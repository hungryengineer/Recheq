import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import { eq, and } from 'drizzle-orm';

export async function deleteWebhookHandler(
  req: { params: Record<string, string>; auth: { orgId: string } },
  deps: { db: Database },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any }> {
  const id = req.params.id as string;
  await deps.db
    .delete(schema.webhook_subscriptions)
    .where(and(eq(schema.webhook_subscriptions.id, id), eq(schema.webhook_subscriptions.org_id, req.auth.orgId)));

  return { status: 204, body: null };
}