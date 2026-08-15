'use server';

import { revalidatePath } from 'next/cache';
import { CaseCreateInput } from '@tieout/schema';
import { apiClient } from './client';

export async function createCase(rawInput: unknown): Promise<unknown> {
  // Zod explicitly strips out malicious/unexpected fields, preventing mass assignment
  const parsed = CaseCreateInput.safeParse(rawInput);
  
  if (!parsed.success) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          fields: parsed.error.issues.map(issue => ({
            path: issue.path[0]?.toString() || 'unknown',
            message: issue.message
          }))
        }
      }
    };
  }

  const input = parsed.data;

  try {
    const result = await apiClient('/cases', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    // Invalidate the cases page cache so Next.js re-renders the list with the fresh data
    revalidatePath('/cases');

    return result;
  } catch (err: unknown) {
    const error = err as Record<string, unknown>;
    return {
      error: {
        code: error.code || 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
      },
    };
  }
}
