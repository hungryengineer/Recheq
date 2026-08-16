'use server';

import { cookies } from 'next/headers';

export type ApiKey = {
  id: string;
  name: string;
  secret: string;
  date: string;
};

export type ApiKeyCreated = ApiKey & {
  fullSecret: string;
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
