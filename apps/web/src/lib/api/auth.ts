'use server';

import type { LoginResponse } from '@tieout/schema';
import { LoginInputSchema, SignupInputSchema } from '@tieout/schema';
import { cookies } from 'next/headers';
import { loginHandler } from '@tieout/api/src/routes/auth/login.js';
import { signupHandler } from '@tieout/api/src/routes/auth/signup.js';
import { getDb } from '@/lib/server/db';

// SSO, forgot-password, reset-password handlers take no arguments in this phase.
// They are stub implementations that will be expanded later.
import { ssoHandler } from '@tieout/api/src/routes/auth/sso.js';
import { forgotPasswordHandler } from '@tieout/api/src/routes/auth/forgot-password.js';
import { resetPasswordHandler } from '@tieout/api/src/routes/auth/reset-password.js';

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

    // Call handler directly instead of self-fetching via HTTP.
    // Server actions run inside the same Next.js process, so a self-fetch
    // via APP_BASE_URL is fragile on Vercel (URL mismatch, cold starts, etc.).
    const result = await loginHandler(
      { body: { email, password, rememberMe }, ip: 'server-action' },
      { db: getDb() },
    );

    if (result.status >= 400) {
      const errorBody = result.body as { error?: { message?: string } };
      if (errorBody.error?.message) {
        return { success: false, error: errorBody.error.message };
      }
      return { success: false, error: 'Authentication failed. Please verify your credentials.' };
    }

    const data = result.body as LoginResponse;

    // Set a secure cookie for session
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

export async function ssoLoginAction(): Promise<AuthActionResult> {
  try {
    const result = await ssoHandler();

    if (result.status >= 400) {
      const errorBody = result.body as { error?: { message?: string } };
      if (errorBody.error?.message) {
        return { success: false, error: errorBody.error.message };
      }
      return { success: false, error: 'SSO Login failed.' };
    }

    const data = result.body as LoginResponse;

    const cookieStore = await cookies();
    cookieStore.set({
      name: 'recheq_session',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });
    return { success: true, data };
  } catch (error) {
    console.error('SSO Login action error:', error);
    return { success: false, error: 'SSO Login failed' };
  }
}

export async function forgotPasswordAction(_email: string): Promise<AuthActionResult> {
  try {
    const result = await forgotPasswordHandler();

    if (result.status >= 400) {
      const errorBody = result.body as { error?: { message?: string } };
      if (errorBody.error?.message) {
        return { success: false, error: errorBody.error.message };
      }
      return { success: false, error: 'Failed to request password reset.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Forgot password action error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again later.' };
  }
}

export async function resetPasswordAction(
  _email: string,
  _code: string,
  _newPassword: string,
): Promise<AuthActionResult> {
  try {
    const result = await resetPasswordHandler();

    if (result.status >= 400) {
      const errorBody = result.body as { error?: { message?: string } };
      if (errorBody.error?.message) {
        return { success: false, error: errorBody.error.message };
      }
      return { success: false, error: 'Failed to reset password.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Reset password action error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again later.' };
  }
}

export async function signupAction(input: unknown): Promise<AuthActionResult> {
  try {
    const parsed = SignupInputSchema.safeParse(input);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const err of parsed.error.issues) {
        fieldErrors[err.path[0]] = err.message;
      }
      return { success: false, errors: fieldErrors };
    }

    const { email, password, fullName, company } = parsed.data;

    const result = await signupHandler(
      { body: { email, password, fullName, company } },
      { db: getDb() },
    );

    if (result.status >= 400) {
      const errorBody = result.body as { error?: { message?: string } };
      if (errorBody.error?.message) {
        return { success: false, error: errorBody.error.message };
      }
      return { success: false, error: 'Registration failed. Please try again.' };
    }

    const data = result.body as LoginResponse;

    // Set a secure cookie for session
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'recheq_session',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return { success: true, data };
  } catch (error) {
    console.error('Signup action error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again later.' };
  }
}

export async function signoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('recheq_session');
}
