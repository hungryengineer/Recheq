'use server';

import { cookies } from 'next/headers';
import {
  ProfileUpdateInputSchema,
  PasswordUpdateInputSchema,
  OrganizationUpdateInputSchema,
  InviteMemberInputSchema,
} from '@recheq/schema';
import type { ActionError } from './actions-types';
import { getDb } from '@/lib/server/db';
import { users } from '@recheq/api/src/db/schema/users.js';
import { organizations } from '@recheq/api/src/db/schema/organizations.js';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '@recheq/api/src/security/session.js';
import { revalidatePath } from 'next/cache';

export type ApiKey = {
  id: string;
  name: string;
  secret: string;
  date: string;
};

export type ApiKeyCreated = ApiKey & {
  fullSecret: string;
};

export type Webhook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
};

export type WebhookCreated = Webhook & {
  secret: string;
};

async function getAuthHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;
  return (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
}

export async function getApiKeysAction(): Promise<ApiKey[]> {
  try {
    const baseUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/settings/keys`, {
      method: 'GET',
      headers: await getAuthHeader(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return [];
  }
}

export async function createApiKeyAction(
  name: string,
): Promise<{ success: boolean; data?: ApiKeyCreated; error?: string }> {
  try {
    const baseUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/settings/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to create API key.' };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Failed to create API key:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function deleteApiKeyAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/settings/keys/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to delete API key.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function getWebhooksAction(): Promise<
  { success: true; data: Webhook[] } | { success: false; error: string }
> {
  try {
    const baseUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/settings/webhooks`, {
      method: 'GET',
      headers: await getAuthHeader(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { success: false, error: `Failed to load webhooks (${response.status})` };
    }

    return { success: true, data: await response.json() };
  } catch (error) {
    console.error('Failed to fetch webhooks:', error);
    return { success: false, error: 'Could not reach the server' };
  }
}

export async function createWebhookAction(
  url: string,
  events: string[],
): Promise<{ success: boolean; data?: WebhookCreated; error?: string }> {
  try {
    const baseUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/settings/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({ url, events }),
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to create webhook.' };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function deleteWebhookAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/settings/webhooks/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to delete webhook.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function updateProfileAction(
  data: unknown,
): Promise<{ success: boolean } | ActionError> {
  const parsed = ProfileUpdateInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;
  if (!token) return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };

  const payload = await verifySessionToken(getDb(), token);
  if (!payload?.userId) {
    return { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } };
  }

  try {
    const db = getDb();
    await db
      .update(users)
      .set({
        name: parsed.data.name,
        email: parsed.data.email,
        avatar: parsed.data.avatar,
        updated_at: new Date(),
      })
      .where(eq(users.id, payload.userId));
  } catch (error) {
    console.error('Failed to update profile:', error);
    return { error: { code: 'INTERNAL_ERROR', message: 'Database error' } };
  }

  revalidatePath('/', 'layout');

  return { success: true };
}

export async function updatePasswordAction(
  data: unknown,
): Promise<{ success: boolean } | ActionError> {
  const parsed = PasswordUpdateInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;
  if (!token) return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };

  const payload = await verifySessionToken(getDb(), token);
  if (!payload?.userId) return { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } };

  try {
    const db = getDb();
    const userResult = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    const user = userResult[0];
    if (!user) return { error: { code: 'UNAUTHORIZED', message: 'User not found' } };

    if (!user.password_hash) {
      return { error: { code: 'VALIDATION_ERROR', message: 'SSO users cannot update password.' } };
    }

    const { default: bcrypt } = await import('bcryptjs');
    const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password_hash);
    if (!isValid) {
      return { error: { code: 'VALIDATION_ERROR', message: 'Incorrect current password' } };
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    // P1: Password change invalidates every previously issued JWT so sessions
    // on other devices (which cannot know the new password) die. The hash and
    // the revocation cutoff are written in ONE atomic UPDATE so a partial
    // failure can never leave old tokens valid with a rotated password.
    await db
      .update(users)
      .set({ password_hash: newHash, token_cutoff_at: new Date(), updated_at: new Date() })
      .where(eq(users.id, payload.userId));
  } catch (error) {
    console.error('Failed to update password:', error);
    return { error: { code: 'INTERNAL_ERROR', message: 'Database error' } };
  }

  revalidatePath('/', 'layout');

  return { success: true };
}

export async function updateOrganizationAction(
  data: unknown,
): Promise<{ success: boolean } | ActionError> {
  const parsed = OrganizationUpdateInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;
  if (!token) return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };

  const payload = await verifySessionToken(getDb(), token);
  if (!payload?.orgId) {
    return { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } };
  }

  try {
    const db = getDb();
    await db
      .update(organizations)
      .set({
        name: parsed.data.companyName,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, payload.orgId));
  } catch (error) {
    console.error('Failed to update organization:', error);
    return { error: { code: 'INTERNAL_ERROR', message: 'Database error' } };
  }

  revalidatePath('/', 'layout');

  return { success: true };
}

export async function inviteMemberAction(
  data: unknown,
): Promise<{ success: boolean } | ActionError> {
  const parsed = InviteMemberInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
  }

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 800));

  return { success: true };
}

export async function getOrganizationMembersAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;
  if (!token) return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };

  const payload = await verifySessionToken(getDb(), token);
  if (!payload?.orgId) {
    return { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } };
  }

  try {
    const db = getDb();
    const orgUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.org_id, payload.orgId));

    return { data: orgUsers };
  } catch (error) {
    console.error('Failed to get members:', error);
    return { error: { code: 'INTERNAL_ERROR', message: 'Database error' } };
  }
}

export async function signOutOtherDevicesAction(): Promise<{ success: boolean } | ActionError> {
  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;
  if (!token) return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };

  const payload = await verifySessionToken(getDb(), token);
  if (!payload?.userId) {
    return { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } };
  }

  try {
    const db = getDb();
    // This revokes all sessions (including the current one, which forces a re-login)
    await db
      .update(users)
      .set({ token_cutoff_at: new Date(), updated_at: new Date() })
      .where(eq(users.id, payload.userId));
  } catch (error) {
    console.error('Failed to revoke sessions:', error);
    return { error: { code: 'INTERNAL_ERROR', message: 'Database error' } };
  }

  // Clear cookie so they are logged out of the current device as well
  cookieStore.delete('recheq_session');
  
  revalidatePath('/', 'layout');
  return { success: true };
}
