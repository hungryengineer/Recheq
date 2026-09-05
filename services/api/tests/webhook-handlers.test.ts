import { describe, it, expect, vi } from 'vitest';
import { createWebhookHandler } from '../src/routes/settings/webhooks/create.js';
import { listWebhooksHandler } from '../src/routes/settings/webhooks/list.js';
import { deleteWebhookHandler } from '../src/routes/settings/webhooks/delete.js';

function fakeDb() {
  const rows: Array<Record<string, unknown>> = [];
  const db = {
    // create: insert().values().returning()
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          const row = { id: 'wh-1', created_at: new Date('2026-01-01T00:00:00Z'), ...values };
          rows.push(row);
          return [row];
        }),
      })),
    })),
    // list: select().from().where().orderBy()
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    // delete: delete().where()
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([])),
    })),
  };
  return { db, rows };
}

describe('createWebhookHandler', () => {
  it('creates a webhook subscription and returns the secret exactly once', async () => {
    const { db } = fakeDb();
    const result = await createWebhookHandler(
      {
        body: { url: 'https://example.com/hooks', events: ['case.completed'] },
        auth: { orgId: 'org-1' },
      },
      { db: db as never },
    );

    expect(result.status).toBe(201);
    const created = result.body as {
      id: string;
      url: string;
      events: string[];
      active: boolean;
      secret: string;
    };
    expect(created).toMatchObject({
      id: 'wh-1',
      url: 'https://example.com/hooks',
      events: ['case.completed'],
      active: true,
    });
    expect(created.secret).toMatch(/^whsec_/);
  });

  it('rejects invalid URLs', async () => {
    const { db } = fakeDb();
    await expect(
      createWebhookHandler(
        { body: { url: 'not-a-url', events: ['case.completed'] }, auth: { orgId: 'org-1' } },
        { db: db as never },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects non-HTTPS webhook URLs', async () => {
    const { db } = fakeDb();
    await expect(
      createWebhookHandler(
        {
          body: { url: 'http://example.com/hooks', events: ['case.completed'] },
          auth: { orgId: 'org-1' },
        },
        { db: db as never },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects private/loopback webhook URLs (SSRF guard)', async () => {
    const { db } = fakeDb();
    for (const url of [
      'https://127.0.0.1/hooks',
      'https://localhost/hooks',
      'https://169.254.169.254/latest/meta-data',
      'https://metadata.google.internal',
    ]) {
      await expect(
        createWebhookHandler(
          { body: { url, events: ['case.completed'] }, auth: { orgId: 'org-1' } },
          { db: db as never },
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it('rejects unsupported event names', async () => {
    const { db } = fakeDb();
    await expect(
      createWebhookHandler(
        { body: { url: 'https://x.com/hooks', events: ['foo.bar'] }, auth: { orgId: 'org-1' } },
        { db: db as never },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('listWebhooksHandler', () => {
  it('returns the org webhooks without the secret', async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() =>
              Promise.resolve([
                {
                  id: 'wh-1',
                  url: 'https://example.com/hooks',
                  events: ['case.completed'],
                  active: true,
                  created_at: new Date('2026-01-01T00:00:00Z'),
                },
              ]),
            ),
          })),
        })),
      })),
    };

    const result = await listWebhooksHandler({ auth: { orgId: 'org-1' } }, { db: db as never });
    expect(result.status).toBe(200);
    expect(result.body).toEqual([
      {
        id: 'wh-1',
        url: 'https://example.com/hooks',
        events: ['case.completed'],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});

describe('deleteWebhookHandler', () => {
  it('deletes the delivery history and subscription inside one transaction', async () => {
    const deliveriesWhere = vi.fn(() => Promise.resolve([]));
    const subscriptionsWhere = vi.fn(() => Promise.resolve([]));
    const tx = {
      delete: vi.fn(() => ({ where: vi.fn() })),
    };
    tx.delete.mockReturnValueOnce({ where: deliveriesWhere }).mockReturnValueOnce({
      where: subscriptionsWhere,
    });
    const db = {
      transaction: vi.fn(async (cb: (t: typeof tx) => Promise<void>) => cb(tx)),
    };

    const result = await deleteWebhookHandler(
      { params: { id: 'wh-1' }, auth: { orgId: 'org-1' } },
      { db: db as never },
    );
    expect(result.status).toBe(204);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(2);
    // deliveries are removed first (FK-safe order), then the subscription,
    // which is both scoped to the org.
    expect(deliveriesWhere).toHaveBeenCalled();
    expect(subscriptionsWhere).toHaveBeenCalled();
  });
});
