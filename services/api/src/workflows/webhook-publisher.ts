import { and, eq } from 'drizzle-orm';
import { schema } from '../db/client.js';
import type { Database } from '../db/client.js';
import { publishJob } from './pgboss.js';
import { WEBHOOK_EVENT_CASE_COMPLETED } from './webhook-worker.js';

// ─── Webhook Publisher ──────────────────────────────────────────
// Enqueues webhook deliveries for an org's active subscriptions whenever a
// case completes with a verdict. Each delivery gets its own webhook_deliveries
// row (for audit/retry visibility) and its own pg-boss job keyed by a
// singleton so a reprocessed case cannot create duplicate in-flight jobs.

export interface CaseCompletedWebhookPayload {
  id: string;
  status: 'complete';
  verdict: string;
  risk_score: number;
  finding_count: number;
  findings: Array<{ rule_id: string; severity: string; title: string }>;
  occurred_at: string;
}

export interface PublishWebhookDeps {
  db: Database;
  canPublish?: boolean;
}

/**
 * Creates delivery rows for matching subscriptions and publishes a job for
 * each. Best-effort: webhook failures must never break the case pipeline.
 */
export async function publishCaseCompletedWebhooks(
  caseId: string,
  orgId: string,
  payload: Omit<CaseCompletedWebhookPayload, 'id' | 'occurred_at' | 'status'>,
  deps: PublishWebhookDeps,
): Promise<void> {
  if (deps.canPublish === false) return;

  const subscriptions = await deps.db
    .select()
    .from(schema.webhook_subscriptions)
    .where(and(eq(schema.webhook_subscriptions.org_id, orgId), eq(schema.webhook_subscriptions.active, true)));

  const matching = subscriptions.filter((sub) => (sub.events ?? []).includes(WEBHOOK_EVENT_CASE_COMPLETED));
  if (matching.length === 0) return;

  const eventPayload: CaseCompletedWebhookPayload = {
    id: caseId,
    status: 'complete',
    verdict: payload.verdict,
    risk_score: payload.risk_score,
    finding_count: payload.finding_count,
    findings: payload.findings,
    occurred_at: new Date().toISOString(),
  };

  for (const subscription of matching) {
    const [delivery] = await deps.db
      .insert(schema.webhook_deliveries)
      .values({
        subscription_id: subscription.id,
        event: WEBHOOK_EVENT_CASE_COMPLETED,
        case_id: caseId,
        payload: {
          event: WEBHOOK_EVENT_CASE_COMPLETED,
          data: eventPayload,
        },
        status: 'pending',
        attempts: 0,
      })
      .returning();

    if (!delivery) continue;

    try {
      await publishJob(
        'WEBHOOK_DELIVERY',
        { delivery_id: delivery.id },
        { singletonKey: `webhook-delivery-${delivery.id}` },
      );
    } catch (err) {
      console.error('Failed to publish webhook job', {
        deliveryId: delivery.id,
        error: (err as Error).message,
      });
    }
  }
}