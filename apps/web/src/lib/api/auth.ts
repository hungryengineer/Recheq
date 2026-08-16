'use server';

import type { LoginResponse } from '@tieout/schema';
import { LoginInputSchema, SignupInputSchema } from '@tieout/schema';
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

    const response = await fetch('http://localhost:4010/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          return { success: false, error: errorData.error.message };
        }
      } catch (e) {
        // Fallback for non-JSON or missing error body
      }
      return { success: false, error: 'Authentication failed. Please verify your credentials.' };
    }

    const data = (await response.json()) as LoginResponse;

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

export async function ssoLoginAction(): Promise<AuthActionResult> {
  try {
    const response = await fetch('http://localhost:4010/api/auth/sso', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          return { success: false, error: errorData.error.message };
        }
      } catch (e) {
        // Fallback for non-JSON or missing error body
      }
      return { success: false, error: 'SSO Login failed.' };
    }

    const data = (await response.json()) as LoginResponse;

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

export async function forgotPasswordAction(email: string): Promise<AuthActionResult> {
  try {
    const response = await fetch('http://localhost:4010/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          return { success: false, error: errorData.error.message };
        }
      } catch (e) {
        // Fallback
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
  email: string,
  code: string,
  newPassword: string,
): Promise<AuthActionResult> {
  try {
    const response = await fetch('http://localhost:4010/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          return { success: false, error: errorData.error.message };
        }
      } catch (e) {
        // Fallback
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

    const response = await fetch('http://localhost:4010/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, fullName, company }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          return { success: false, error: errorData.error.message };
        }
      } catch (e) {
        // Fallback for non-JSON or missing error body
      }
      return { success: false, error: 'Registration failed. Please try again.' };
    }

    const data = (await response.json()) as LoginResponse;

    // Set a secure mock cookie for session
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
