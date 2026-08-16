'use server';

import { revalidatePath } from 'next/cache';
import { CaseCreateInput } from '@tieout/schema';
import type { CaseRecord } from '@tieout/schema';
import { createCase as persistCase, AppError } from '@tieout/api/web';
import { getCaseDeps, DEV_ORG_ID, DEV_USER_ID } from './db';

export type CreateCaseResult =
  | { success: true; data: CaseRecord }
  | { success: false; error: string };

export async function createCase(rawInput: unknown): Promise<CreateCaseResult> {
  try {
    // Zod explicitly strips out malicious/unexpected fields, preventing mass assignment
    const input = CaseCreateInput.parse(rawInput);

    const caseRecord = await persistCase(input, DEV_USER_ID, DEV_ORG_ID, getCaseDeps());

    // Invalidate the cases page cache so Next.js re-renders the list with the fresh data
    revalidatePath('/cases');

    return { success: true, data: caseRecord };
  } catch (err) {
    // Validation and domain errors carry a user-safe message — expose it directly.
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    // For all other failures log the full error server-side but return a stable,
    // non-leaking message to the client.
    console.error('[createCase] unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
