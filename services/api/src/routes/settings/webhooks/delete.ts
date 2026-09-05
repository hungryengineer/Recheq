import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import { eq, and } from 'drizzle-orm';
import type { HandlerResult } from './create.js';

// Deletes the subscription together with its delivery history so the
// `webhook_deliveries.subscription_id` FK (ON DELETE no action) never rejects
// the request after deliveries have been recorded.
export async function deleteWebhookHandler(
  req: { params: Record<string, string>; auth: { orgId: string } },
  deps: { db: Database },
): Promise<HandlerResult> {
  const id = req.params.id as string;
  await deps.db.transaction(async (tx) => {
    await tx
      .delete(schema.webhook_deliveries)
      .where(eq(schema.webhook_deliveries.subscription_id, id));
    await tx
      .delete(schema.webhook_subscriptions)
      .where(
        and(
          eq(schema.webhook_subscriptions.id, id),
          eq(schema.webhook_subscriptions.org_id, req.auth.orgId),
        ),
      );
  });

  return { status: 204, body: null };
}
