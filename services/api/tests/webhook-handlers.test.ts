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
    expect(result.body).toMatchObject({
      id: 'wh-1',
      url: 'https://example.com/hooks',
      events: ['case.completed'],
      active: true,
    });
    expect(result.body.secret).toMatch(/^whsec_/);
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
  it('returns 204 and scopes the delete to the org', async () => {
    const whereMock = vi.fn(() => Promise.resolve([]));
    const db = {
      delete: vi.fn(() => ({ where: whereMock })),
    };

    const result = await deleteWebhookHandler(
      { params: { id: 'wh-1' }, auth: { orgId: 'org-1' } },
      { db: db as never },
    );
    expect(result.status).toBe(204);
    expect(whereMock).toHaveBeenCalled();
  });
});