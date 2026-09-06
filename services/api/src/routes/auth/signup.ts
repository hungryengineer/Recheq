import { randomUUID } from 'node:crypto';
import { SignupInputSchema, type LoginResponse } from '@recheq/schema';
import { eq } from 'drizzle-orm';
import { AppError, toErrorResponse, type ApiError } from '../../http/errors.js';
import type { Database } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { signToken } from '../../security/jwt.js';
import bcrypt from 'bcryptjs';

type SignupHandlerResult = { status: number; body: LoginResponse | ApiError };

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

/** Normalize a company name into a URL-safe org slug. */
export function baseSlug(company: string): string {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `org-${randomUUID().slice(0, 8)}`;
}

async function isSlugTaken(tx: Pick<Database, 'select'>, slug: string): Promise<boolean> {
  const [existing] = await tx
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, slug))
    .limit(1);
  return Boolean(existing);
}

/**
 * Resolve a non-colliding org slug. `organizations.slug` is UNIQUE but the
 * naive `company.toLowerCase().replace(...)` slug collided for any two
 * companies resolving to the same slug (e.g. "Acme Inc" twice), which used to
 * surface as a generic 500. Probe the table and append a short random suffix
 * when the base slug is taken.
 */
async function resolveUniqueSlug(tx: Pick<Database, 'select'>, company: string): Promise<string> {
  const root = baseSlug(company);
  if (!(await isSlugTaken(tx, root))) {
    return root;
  }
  return `${root}-${randomUUID().slice(0, 8)}`;
}

export async function signupHandler(
  req: { body: unknown },
  deps: { db: Database },
): Promise<SignupHandlerResult> {
  try {
    const parseResult = SignupInputSchema.safeParse(req.body);

    if (!parseResult.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input');
    }

    const { email, password, fullName, company } = parseResult.data;

    const [existingUser] = await deps.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingUser) {
      throw new AppError(409, 'CONFLICT', 'User already exists');
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Create the org and user atomically so a partial write can never leave an
    // org without its admin, or a user referencing a missing org.
    const result = await deps.db.transaction(async (tx) => {
      const slug = await resolveUniqueSlug(tx, company);

      const [org] = await tx
        .insert(schema.organizations)
        .values({
          name: company,
          slug,
        })
        .returning();

      if (!org) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create organization');

      const [user] = await tx
        .insert(schema.users)
        .values({
          email,
          password_hash,
          name: fullName,
          org_id: org.id,
          role: 'admin',
        })
        .returning();

      if (!user) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create user');

      return { user, org };
    });

    const token = await signToken({
      userId: result.user.id,
      orgId: result.user.org_id,
      role: result.user.role,
    });

    return {
      status: 201,
      body: {
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
      },
    };
  } catch (error) {
    // A duplicate org slug (or a race between the probe and the insert) must be
    // reported as a clear 409 CONFLICT rather than leaking as a generic 500.
    if (isPostgresUniqueViolation(error)) {
      return toErrorResponse(new AppError(409, 'CONFLICT', 'Organization name already registered'));
    }

    return toErrorResponse(error);
  }
}
