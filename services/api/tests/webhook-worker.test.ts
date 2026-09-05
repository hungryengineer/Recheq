import { describe, it, expect, vi } from 'vitest';
import {
  computeWebhookSignature,
  verifyWebhookSignature,
  deliverWebhook,
  WEBHOOK_EVENT_CASE_COMPLETED,
  type WebhookDeliveryJob,
} from '../src/workflows/webhook-worker.js';
import type PgBoss from 'pg-boss';
import { schema } from '../src/db/client.js';

// ─── Minimal chainable fake db for drizzle query builders ───────
type Row = Record<string, unknown>;

function tableKey(table: unknown): 'webhook_deliveries' | 'webhook_subscriptions' | null {
  if (table === schema.webhook_deliveries) return 'webhook_deliveries';
  if (table === schema.webhook_subscriptions) return 'webhook_subscriptions';
  return null;
}

function makeFakeDb(initial: { webhook_deliveries: Row[]; webhook_subscriptions: Row[] }) {
  const store = {
    webhook_deliveries: [...initial.webhook_deliveries],
    webhook_subscriptions: [...initial.webhook_subscriptions],
  };

  let fromTable: 'webhook_deliveries' | 'webhook_subscriptions' | null = null;

  const db = {
    select: vi.fn(() => query()),
    update: vi.fn(() => ({
      set: vi.fn((data: Row) => ({
        where: vi.fn(async () => {
          // The worker only ever updates one delivery row at a time; applying
          // to every row keeps the fake simple without parsing drizzle SQL.
          for (const row of store.webhook_deliveries) Object.assign(row, data);
          return [];
        }),
      })),
    })),
  };

  function query() {
    const chain = {
      from: vi.fn((table: unknown) => {
        fromTable = tableKey(table);
        return chain;
      }),
      where: vi.fn(() => chain),
      limit: vi.fn(() => {
        if (!fromTable) return Promise.resolve([]);
        return Promise.resolve(store[fromTable]);
      }),
    };
    return chain;
  }

  return { db, store };
}

const subscription = {
  id: 'sub-1',
  org_id: 'org-1',
  url: 'https://example.com/hooks',
  secret: 'whsec_testsecret',
  events: [WEBHOOK_EVENT_CASE_COMPLETED],
  active: true,
};

const delivery = {
  id: 'del-1',
  subscription_id: 'sub-1',
  event: WEBHOOK_EVENT_CASE_COMPLETED,
  case_id: 'case-1',
  payload: { event: WEBHOOK_EVENT_CASE_COMPLETED, data: { verdict: 'verified' } },
  status: 'pending',
  attempts: 0,
  response_status: null,
  response_body_preview: null,
  error_message: null,
};

function job(deliveryId: string): PgBoss.Job<WebhookDeliveryJob> {
  return {
    id: 'job-1',
    name: 'webhook_delivery' as const,
    data: { delivery_id: deliveryId },
    // The worker only reads `job.data`, so the remaining pg-boss job fields are
    // intentionally omitted; the cast keeps the fixture type-safe without
    // enumerating the full library shape.
  } as PgBoss.Job<WebhookDeliveryJob>;
}

describe('webhook signature', () => {
  it('computes a deterministic HMAC-SHA256 signature', () => {
    const body = JSON.stringify({ event: 'case.completed' });
    const a = computeWebhookSignature('whsec_abc', body);
    const b = computeWebhookSignature('whsec_abc', body);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyWebhookSignature accepts the matching signature and rejects bad ones', () => {
    const body = JSON.stringify({ a: 1 });
    const good = computeWebhookSignature('secret', body);
    expect(verifyWebhookSignature('secret', body, good)).toBe(true);
    expect(verifyWebhookSignature('secret', body, 'deadbeef')).toBe(false);
    expect(verifyWebhookSignature('other', body, good)).toBe(false);
  });
});

describe('deliverWebhook', () => {
  it('POSTs the signed payload and records the delivery as succeeded', async () => {
    const { db, store } = makeFakeDb({
      webhook_deliveries: [{ ...delivery }],
      webhook_subscriptions: [{ ...subscription }],
    });
    const httpPost = vi.fn(
      async (
        _url: string,
        _init: { body: string; headers: Record<string, string>; signal: AbortSignal },
      ) => ({ status: 200, body: 'ok' }),
    );

    await deliverWebhook(job('del-1'), { db: db as never, httpPost });

    const sent = httpPost.mock.calls[0]!;
    expect(sent[0]).toBe('https://example.com/hooks');
    const headers = sent[1].headers;
    expect(headers['X-Recheq-Event']).toBe('case.completed');
    expect(headers['X-Recheq-Signature']).toBe(
      `sha256=${computeWebhookSignature('whsec_testsecret', sent[1].body)}`,
    );
    expect(headers['X-Recheq-Delivery']).toBe('del-1');
    expect(JSON.parse(sent[1].body)).toEqual(delivery.payload);

    const row = store.webhook_deliveries[0]!;
    expect(row.status).toBe('succeeded');
    expect(row.attempts).toBe(1);
    expect(row.response_status).toBe(200);
  });

  it('records a failed delivery and throws when the endpoint returns non-2xx', async () => {
    const { db, store } = makeFakeDb({
      webhook_deliveries: [{ ...delivery }],
      webhook_subscriptions: [{ ...subscription }],
    });
    const httpPost = vi.fn(
      async (
        _url: string,
        _init: { body: string; headers: Record<string, string>; signal: AbortSignal },
      ) => ({ status: 503, body: 'nope' }),
    );

    await expect(deliverWebhook(job('del-1'), { db: db as never, httpPost })).rejects.toThrow(
      /returned 503/,
    );
    const row = store.webhook_deliveries[0]!;
    expect(row.status).toBe('failed');
    expect(row.attempts).toBe(1);
    expect(row.response_status).toBe(503);
  });

  it('records the error and re-throws on network failure', async () => {
    const { db, store } = makeFakeDb({
      webhook_deliveries: [{ ...delivery }],
      webhook_subscriptions: [{ ...subscription }],
    });
    const httpPost = vi.fn(
      async (
        _url: string,
        _init: { body: string; headers: Record<string, string>; signal: AbortSignal },
      ) => {
        throw new Error('ECONNREFUSED');
      },
    );

    await expect(deliverWebhook(job('del-1'), { db: db as never, httpPost })).rejects.toThrow(
      'ECONNREFUSED',
    );
    expect(store.webhook_deliveries[0]!.status).toBe('failed');
    expect(store.webhook_deliveries[0]!.error_message).toBe('ECONNREFUSED');
  });

  it('skips redelivery idempotently when already succeeded', async () => {
    const { db } = makeFakeDb({
      webhook_deliveries: [{ ...delivery, status: 'succeeded', attempts: 1 }],
      webhook_subscriptions: [{ ...subscription }],
    });
    const httpPost = vi.fn();

    await deliverWebhook(job('del-1'), { db: db as never, httpPost });
    expect(httpPost).not.toHaveBeenCalled();
  });

  it('cancels the delivery when the subscription is inactive or gone', async () => {
    const { db, store } = makeFakeDb({
      webhook_deliveries: [{ ...delivery }],
      webhook_subscriptions: [{ ...subscription, active: false }],
    });
    const httpPost = vi.fn();

    await deliverWebhook(job('del-1'), { db: db as never, httpPost });
    expect(httpPost).not.toHaveBeenCalled();
    expect(store.webhook_deliveries[0]!.status).toBe('cancelled');
  });

  it('throws on a malformed job payload', async () => {
    const { db } = makeFakeDb({ webhook_deliveries: [], webhook_subscriptions: [] });
    const httpPost = vi.fn();
    const badJob = { id: 'j', data: { nope: true } } as never;

    await expect(deliverWebhook(badJob, { db: db as never, httpPost })).rejects.toThrow(
      /Invalid webhook delivery payload/,
    );
    expect(httpPost).not.toHaveBeenCalled();
  });

  it('fails permanently without retrying when the subscription URL is unsafe (SSRF)', async () => {
    const { db, store } = makeFakeDb({
      webhook_deliveries: [{ ...delivery }],
      webhook_subscriptions: [{ ...subscription, url: 'http://169.254.169.254/latest/meta-data' }],
    });
    const httpPost = vi.fn();

    await deliverWebhook(job('del-1'), { db: db as never, httpPost });
    expect(httpPost).not.toHaveBeenCalled();
    const row = store.webhook_deliveries[0]!;
    expect(row.status).toBe('failed');
    expect(row.error_message).toMatch(/blocked|required/i);
  });
});
