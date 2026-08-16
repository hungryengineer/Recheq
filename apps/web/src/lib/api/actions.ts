'use server';

import { revalidatePath } from 'next/cache';
import { CaseCreateInput } from '@tieout/schema';
import { apiClient } from './client';

type CreateCaseError = {
  error: {
    code: string;
    message?: string;
    details?: {
      fields?: Array<{ path: string; message: string }>;
    };
  };
};

type CreateCaseSuccess = {
  candidate_link?: string;
  id?: string;
};

export type CreateCaseResult = CreateCaseSuccess | CreateCaseError;

export function isCreateCaseError(result: CreateCaseResult): result is CreateCaseError {
  return 'error' in result;
}

export async function createCase(rawInput: unknown): Promise<CreateCaseResult> {
  // Zod explicitly strips out malicious/unexpected fields, preventing mass assignment
  const parsed = CaseCreateInput.safeParse(rawInput);

  if (!parsed.success) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path[0]?.toString() ?? 'unknown',
            message: issue.message,
          })),
        },
      },
    };
  }

  const input = parsed.data;

  try {
    const result = (await apiClient('/cases', {
      method: 'POST',
      body: JSON.stringify(input),
    })) as CreateCaseSuccess;

    // Invalidate the cases page cache so Next.js re-renders the list with the fresh data
    revalidatePath('/cases');

    return result;
  } catch (err: unknown) {
    const isAppError = typeof err === 'object' && err !== null;
    const error = isAppError ? (err as Record<string, unknown>) : {};
    return {
      error: {
        code: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR',
        message:
          typeof error.message === 'string' ? error.message : 'An unexpected error occurred.',
        details: error.details as CreateCaseError['error']['details'],
      },
    };
  }
}
