import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/workflows/pgboss.js', () => ({
  publishJob: vi.fn(async () => 'job-id'),
}));

import { publishJob } from '../src/workflows/pgboss.js';
import { publishCaseCompletedWebhooks } from '../src/workflows/webhook-publisher.js';

const publishJobMock = vi.mocked(publishJob);

function makeFakeDb(initial: { webhook_subscriptions: Array<Record<string, unknown>> }) {
  const store = {
    webhook_subscriptions: [...initial.webhook_subscriptions],
    webhook_deliveries: [] as Array<Record<string, unknown>>,
  };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(store.webhook_subscriptions)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          const row = { id: `del-${store.webhook_deliveries.length + 1}`, ...values };
          store.webhook_deliveries.push(row);
          return [row];
        }),
      })),
    })),
  };

  return { db, store };
}

describe('publishCaseCompletedWebhooks', () => {
  beforeEach(() => {
    publishJobMock.mockClear();
  });

  it('creates delivery rows and publishes a job for matching subscriptions', async () => {
    const { db, store } = makeFakeDb({
      webhook_subscriptions: [
        {
          id: 'sub-1',
          org_id: 'org-1',
          url: 'https://example.com/hooks',
          secret: 'whsec_x',
          events: ['case.completed'],
          active: true,
        },
      ],
    });

    await publishCaseCompletedWebhooks(
      'case-1',
      'org-1',
      { verdict: 'verified', risk_score: 5, finding_count: 1, findings: [{ rule_id: 'r1', severity: 'high', title: 'Mismatch' }] },
      { db: db as never, canPublish: true },
    );

    expect(store.webhook_deliveries).toHaveLength(1);
    const delivery = store.webhook_deliveries[0];
    expect(delivery.subscription_id).toBe('sub-1');
    expect(delivery.event).toBe('case.completed');
    expect(delivery.case_id).toBe('case-1');
    expect(delivery.status).toBe('pending');
    expect((delivery.payload as { event: string }).event).toBe('case.completed');

    expect(publishJobMock).toHaveBeenCalledTimes(1);
    expect(publishJobMock).toHaveBeenCalledWith(
      'WEBHOOK_DELIVERY',
      { delivery_id: 'del-1' },
      { singletonKey: 'webhook-delivery-del-1' },
    );
  });

  it('ignores subscriptions that did not subscribe to case.completed', async () => {
    const { db, store } = makeFakeDb({
      webhook_subscriptions: [
        {
          id: 'sub-1',
          org_id: 'org-1',
          url: 'https://example.com/hooks',
          secret: 'whsec_x',
          events: ['some.other.event'],
          active: true,
        },
      ],
    });

    await publishCaseCompletedWebhooks(
      'case-1',
      'org-1',
      { verdict: 'verified', risk_score: 5, finding_count: 0, findings: [] },
      { db: db as never, canPublish: true },
    );

    expect(store.webhook_deliveries).toHaveLength(0);
    expect(publishJobMock).not.toHaveBeenCalled();
  });

  it('is a no-op when canPublish is false', async () => {
    const { db, store } = makeFakeDb({ webhook_subscriptions: [] });
    await publishCaseCompletedWebhooks(
      'case-1',
      'org-1',
      { verdict: 'verified', risk_score: 5, finding_count: 0, findings: [] },
      { db: db as never, canPublish: false },
    );
    expect(store.webhook_deliveries).toHaveLength(0);
    expect(db.select).not.toHaveBeenCalled();
  });
});