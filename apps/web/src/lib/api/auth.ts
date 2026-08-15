'use server';

import type { LoginResponse } from '@tieout/schema';
import { LoginInputSchema } from '@tieout/schema';
import { cookies } from 'next/headers';

export type AuthActionResult = {
  success: boolean;
  errors?: Record<string, string>;
  error?: string;
  data?: LoginResponse;
};

export async function loginAction(input: unknown): Promise<AuthActionResult> {
  try {
    // Validate input
    const parsed = LoginInputSchema.safeParse(input);
    
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const err of parsed.error.issues) {
        fieldErrors[err.path[0]] = err.message;
      }
      return { success: false, errors: fieldErrors };
    }

    const { email, password, rememberMe } = parsed.data;

    // Strict admin credential enforcement for the mock environment
    const ADMIN_EMAIL = 'admin@recheq.com';
    const ADMIN_PASS = 'Admin@123!';

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASS) {
      return { success: false, error: 'Invalid credentials. Please use the correct admin credentials.' };
    }

    const response = await fetch('http://localhost:4010/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    if (!response.ok) {
      return { success: false, error: 'Authentication failed. Please verify your credentials.' };
    }

    const data = await response.json() as LoginResponse;

    // Set a secure mock cookie for session
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'recheq_session',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: rememberMe ? 60 * 60 * 24 * 30 : undefined, // 30 days if remember me
    });

    return { success: true, data };
    
  } catch (error) {
    console.error('Login action error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again later.' };
  }
}
