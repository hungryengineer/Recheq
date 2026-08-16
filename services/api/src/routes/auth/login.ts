import { LoginInputSchema, type LoginResponse } from '@tieout/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../../http/errors.js';
import type { Database } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { signToken } from '../../security/jwt.js';
import bcrypt from 'bcryptjs';

export async function loginHandler(
  req: { body: unknown },
  deps: { db: Database },
): Promise<{ status: number; body: LoginResponse }> {
  const parseResult = LoginInputSchema.safeParse(req.body);

  if (!parseResult.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid credentials');
  }

  const { email, password } = parseResult.data;

  // Find user by email
  const [user] = await deps.db.select().from(schema.users).where(eq(schema.users.email, email));

  if (!user || !user.password_hash) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  // Sign JWT
  const token = await signToken({
    userId: user.id,
    orgId: user.org_id,
    role: user.role,
  });

  return {
    status: 200,
    body: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
  };
}
