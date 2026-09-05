import { z } from 'zod';
import { AppError } from '../../../http/errors.js';
import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import crypto from 'node:crypto';
import { isSafeWebhookUrl } from '../../../security/webhook-url.js';

const CreateWebhookInput = z.object({
  url: z
    .string()
    .url('URL must be a valid http(s) URL')
    .refine(isSafeWebhookUrl, 'URL must use HTTPS and a public (non-private/loopback) host'),
  events: z
    .array(z.string())
    .min(1, 'At least one event must be subscribed')
    .default(['case.completed']),
});

const WEBHOOK_EVENTS = new Set(['case.completed']);

export interface WebhookSubscriptionView {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface WebhookSubscriptionCreated extends WebhookSubscriptionView {
  /** Only returned once at creation; must be stored by the customer. */
  secret: string;
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

// ─── Webhook Subscription Create ────────────────────────────────
export async function createWebhookHandler(
  req: { body: unknown; auth: { orgId: string } },
  deps: { db: Database },
): Promise<HandlerResult> {
  const parsed = CreateWebhookInput.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join('; '),
    );
  }

  const { url, events } = parsed.data;
  for (const event of events) {
    if (!WEBHOOK_EVENTS.has(event)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Unsupported webhook event: ${event}`);
    }
  }

  const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;

  const [webhook] = await deps.db
    .insert(schema.webhook_subscriptions)
    .values({
      org_id: req.auth.orgId,
      url,
      secret,
      events,
      active: true,
    })
    .returning();

  if (!webhook) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create webhook');

  const body: WebhookSubscriptionCreated = {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    active: webhook.active,
    createdAt: webhook.created_at.toISOString(),
    secret, // Only returned once
  };
  return { status: 201, body };
}
