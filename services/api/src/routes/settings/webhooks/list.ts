import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import { eq } from 'drizzle-orm';

export async function listWebhooksHandler(
  req: { auth: { orgId: string } },
  deps: { db: Database },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any }> {
  const rows = await deps.db
    .select({
      id: schema.webhook_subscriptions.id,
      url: schema.webhook_subscriptions.url,
      events: schema.webhook_subscriptions.events,
      active: schema.webhook_subscriptions.active,
      created_at: schema.webhook_subscriptions.created_at,
    })
    .from(schema.webhook_subscriptions)
    .where(eq(schema.webhook_subscriptions.org_id, req.auth.orgId))
    .orderBy(schema.webhook_subscriptions.created_at);

  return {
    status: 200,
    body: rows.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.created_at.toISOString(),
    })),
  };
}