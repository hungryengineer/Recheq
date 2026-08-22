/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { CaseCreateInput } from '@tieout/schema';
import { apiClient } from './client';
import type { CreateCaseResult, CreateCaseError } from './actions-types';

// Re-export types only — value exports (non-async functions) are not allowed in 'use server' files
export type {
  CreateCaseResult,
  CreateCaseSuccess,
  CreateCaseError,
  UpdateCaseResult,
  UpdateCaseSuccess,
} from './actions-types';
import type { UpdateCaseResult } from './actions-types';
import { CaseUpdateInput } from '@tieout/schema';

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
    })) as any;

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

export async function updateCase(caseId: string, rawInput: unknown): Promise<UpdateCaseResult> {
  const parsed = CaseUpdateInput.safeParse(rawInput);

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
    const result = (await apiClient(`/cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })) as any;

    revalidatePath(`/cases/${caseId}`);
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
