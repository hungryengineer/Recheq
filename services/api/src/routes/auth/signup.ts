import { SignupInputSchema, type LoginResponse } from '@recheq/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../../http/errors.js';
import type { Database } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { signToken } from '../../security/jwt.js';
import bcrypt from 'bcryptjs';

export async function signupHandler(
  req: { body: unknown },
  deps: { db: Database },
): Promise<{ status: number; body: LoginResponse }> {
  const parseResult = SignupInputSchema.safeParse(req.body);

  if (!parseResult.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input');
  }

  const { email, password, fullName, company } = parseResult.data;

  // Check if user already exists
  const [existingUser] = await deps.db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existingUser) {
    throw new AppError(409, 'CONFLICT', 'User already exists');
  }

  const password_hash = await bcrypt.hash(password, 10);

  // We need a transaction to create org and user together
  const result = await deps.db.transaction(async (tx) => {
    // 1. Create Organization
    const [org] = await tx
      .insert(schema.organizations)
      .values({
        name: company,
        slug: company.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      })
      .returning();

    if (!org) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create organization');

    // 2. Create User
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

  // Sign JWT
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
}
