import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { schema } from '../db/client.js';
import type { Database } from '../db/client.js';

// ─── Webhook Delivery Worker ────────────────────────────────────
// Replaces the previous console.log stub. Loads the subscription, signs the
// payload with HMAC-SHA256, POSTs it to the endpoint, and records the outcome
// in webhook_deliveries. Non-2xx / network errors are re-thrown so pg-boss
// retries the job (retryLimit 5, retryDelay 15s) and the attempts column
// reflects each delivery attempt.

export const WEBHOOK_EVENT_CASE_COMPLETED = 'case.completed';

export const WebhookDeliveryPayload = z.object({
  delivery_id: z.string(),
});

export type WebhookDeliveryJob = z.infer<typeof WebhookDeliveryPayload>;

export interface WebhookDeliveryDeps {
  db: Database;
  httpPost?: (
    url: string,
    init: { body: string; headers: Record<string, string>; signal: AbortSignal },
  ) => Promise<{ status: number; body: string }>;
  now?: () => Date;
}

const POST_TIMEOUT_MS = 10_000;

export function computeWebhookSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyWebhookSignature(secret: string, body: string, signature: string): boolean {
  const expected = computeWebhookSignature(secret, body);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function defaultHttpPost(
  url: string,
  init: { body: string; headers: Record<string, string>; signal: AbortSignal },
): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: init.headers,
    body: init.body,
    signal: init.signal,
  });
  const body = await res.text();
  return { status: res.status, body };
}

export async function deliverWebhook(
  jobsParam: PgBoss.Job<WebhookDeliveryJob> | PgBoss.Job<WebhookDeliveryJob>[],
  deps: WebhookDeliveryDeps,
): Promise<void> {
  const jobs = Array.isArray(jobsParam) ? jobsParam : [jobsParam];
  for (const job of jobs) {
    await deliverOne(job, deps);
  }
}

async function deliverOne(job: PgBoss.Job<WebhookDeliveryJob>, deps: WebhookDeliveryDeps): Promise<void> {
  const { db, now = () => new Date() } = deps;
  const httpPost = deps.httpPost ?? defaultHttpPost;

  const parsed = WebhookDeliveryPayload.safeParse(job.data);
  if (!parsed.success) {
    // Malformed job: nothing sensible to do; throw so pg-boss can retry/surface.
    throw new Error('Invalid webhook delivery payload');
  }

  const [delivery] = await db
    .select()
    .from(schema.webhook_deliveries)
    .where(eq(schema.webhook_deliveries.id, parsed.data.delivery_id))
    .limit(1);

  if (!delivery) {
    throw new Error(`Webhook delivery ${parsed.data.delivery_id} not found`);
  }

  // Already succeeded — pg-boss may redeliver; skip idempotently.
  if (delivery.status === 'succeeded') {
    return;
  }

  const [subscription] = await db
    .select()
    .from(schema.webhook_subscriptions)
    .where(eq(schema.webhook_subscriptions.id, delivery.subscription_id))
    .limit(1);

  if (!subscription || !subscription.active) {
    // Subscription gone or disabled: job no longer meaningful.
    await db
      .update(schema.webhook_deliveries)
      .set({ status: 'cancelled', completed_at: now() })
      .where(eq(schema.webhook_deliveries.id, delivery.id));
    return;
  }

  const body = JSON.stringify(delivery.payload);
  const signature = computeWebhookSignature(subscription.secret, body);
  const attempt = delivery.attempts + 1;

  await db
    .update(schema.webhook_deliveries)
    .set({ status: 'delivering', attempts: attempt })
    .where(eq(schema.webhook_deliveries.id, delivery.id));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

  try {
    const result = await httpPost(subscription.url, {
      body,
      headers: {
        'Content-Type': 'application/json',
        'X-Recheq-Event': delivery.event,
        'X-Recheq-Delivery': String(delivery.id),
        'X-Recheq-Signature': `sha256=${signature}`,
      },
      signal: controller.signal,
    });

    if (result.status >= 200 && result.status < 300) {
      await db
        .update(schema.webhook_deliveries)
        .set({
          status: 'succeeded',
          response_status: result.status,
          response_body_preview: result.body.slice(0, 500),
          completed_at: now(),
          })
        .where(eq(schema.webhook_deliveries.id, delivery.id));
      console.log('webhook delivered', { deliveryId: delivery.id, status: result.status });
      return;
    }

    const errorMessage = `Webhook endpoint returned ${result.status}`;
    await db
      .update(schema.webhook_deliveries)
      .set({
        status: 'failed',
        attempts: attempt,
        response_status: result.status,
        response_body_preview: result.body.slice(0, 500),
        error_message: errorMessage,
      })
      .where(eq(schema.webhook_deliveries.id, delivery.id));
    throw new Error(errorMessage);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.webhook_deliveries)
      .set({
        status: 'failed',
        attempts: attempt,
        error_message: message.slice(0, 500),
      })
      .where(eq(schema.webhook_deliveries.id, delivery.id));
    throw err;
  } finally {
    clearTimeout(timer);
  }
}