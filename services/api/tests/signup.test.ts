import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signupHandler, baseSlug } from '../src/routes/auth/signup.js';
import * as jwt from '../src/security/jwt.js';
import type { Database } from '../src/db/client.js';

const validSignup = {
  fullName: 'Priya Sharma',
  email: 'priya@example.com',
  company: 'Acme Corp',
  password: 'password123',
};

function makeMockDb(options: {
  existingUser?: { id: string; email: string } | null;
  existingSlugs?: Set<string>;
  insertThrowsUnique?: boolean;
}): Database {
  const slugs = new Set(options.existingSlugs ?? []);
  let emailLookupDone = false;

  const buildSelectWhere = (forSlugCheck: boolean) =>
    vi.fn().mockImplementation(async () => {
      if (!forSlugCheck) {
        emailLookupDone = true;
        return options.existingUser ? [options.existingUser] : [];
      }

      return slugs.size > 0 ? [{ id: 'existing-org' }] : [];
    });

  const mockDb = {
    select: vi.fn().mockImplementation(() => {
      const forSlugCheck = emailLookupDone;
      return {
        from: vi.fn().mockReturnValue({
          where: buildSelectWhere(forSlugCheck),
        }),
      };
    }),
    transaction: vi.fn(async (cb: (tx: Database) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(async () => {
              if (slugs.has(baseSlug(validSignup.company))) {
                return [{ id: 'existing-org' }];
              }
              return [];
            }),
          }),
        }),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((values: Record<string, unknown>) => ({
            returning: vi.fn().mockImplementation(async () => {
              if (options.insertThrowsUnique) {
                const err = new Error('duplicate key value violates unique constraint') as Error & {
                  code: string;
                };
                err.code = '23505';
                throw err;
              }

              if ('slug' in values) {
                const slug = values.slug as string;
                if (slugs.has(slug)) {
                  const err = new Error(
                    'duplicate key value violates unique constraint',
                  ) as Error & {
                    code: string;
                  };
                  err.code = '23505';
                  throw err;
                }
                slugs.add(slug);
                return [{ id: 'org-1', name: values.name, slug }];
              }

              return [
                {
                  id: 'user-1',
                  email: values.email,
                  password_hash: values.password_hash,
                  name: values.name,
                  org_id: values.org_id,
                  role: values.role,
                },
              ];
            }),
          })),
        })),
      };

      return cb(tx as unknown as Database);
    }),
  };

  return mockDb as unknown as Database;
}

describe('baseSlug', () => {
  it('normalizes company names', () => {
    expect(baseSlug('Acme Corp')).toBe('acme-corp');
    expect(baseSlug('Acme-Corp')).toBe('acme-corp');
  });

  it('falls back to a random slug when company has no alphanumerics', () => {
    expect(baseSlug('!!!')).toMatch(/^org-[a-f0-9]{8}$/);
  });
});

describe('signupHandler', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    jwt._clearSecretKeyForTest();
    vi.spyOn(jwt, 'signToken').mockResolvedValue('test-jwt-token');
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    jwt._clearSecretKeyForTest();
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid input without throwing', async () => {
    const db = makeMockDb({});
    const response = await signupHandler({ body: { email: 'not-an-email' } }, { db });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
    });
  });

  it('returns 409 when email already exists without throwing', async () => {
    const db = makeMockDb({
      existingUser: { id: 'user-existing', email: validSignup.email },
    });

    const response = await signupHandler({ body: validSignup }, { db });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: 'CONFLICT', message: 'User already exists' },
    });
  });

  it('returns 201 with token on success without throwing', async () => {
    const db = makeMockDb({});

    const response = await signupHandler({ body: validSignup }, { db });

    expect(response.status).toBe(201);
    if ('token' in response.body) {
      expect(response.body.token).toBeTruthy();
      expect(response.body.user.email).toBe(validSignup.email);
    } else {
      throw new Error('Expected success body');
    }
  });

  it('returns 409 with structured body on slug unique violation', async () => {
    const db = makeMockDb({ insertThrowsUnique: true });

    const response = await signupHandler({ body: validSignup }, { db });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: 'CONFLICT', message: 'Organization name already registered' },
    });
  });

  it('returns 409 when slug collision persists after retries', async () => {
    const db = makeMockDb({ existingSlugs: new Set(['acme-corp']) });

    const response = await signupHandler({ body: validSignup }, { db });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: 'CONFLICT', message: 'Organization name already registered' },
    });
  });
});
