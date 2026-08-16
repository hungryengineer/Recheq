'use server';

import { revalidatePath } from 'next/cache';
import { CaseCreateInput } from '@tieout/schema';
import type { CaseRecord } from '@tieout/schema';
import { createCase as persistCase } from '@tieout/api/web';
import { getCaseDeps, DEV_ORG_ID, DEV_USER_ID } from './db';

export type CreateCaseResult =
  { success: true; data: CaseRecord } | { success: false; error: string };

export async function createCase(rawInput: unknown): Promise<CreateCaseResult> {
  try {
    // Zod explicitly strips out malicious/unexpected fields, preventing mass assignment
    const input = CaseCreateInput.parse(rawInput);

    const caseRecord = await persistCase(input, DEV_USER_ID, DEV_ORG_ID, getCaseDeps());

    // Invalidate the cases page cache so Next.js re-renders the list with the fresh data
    revalidatePath('/cases');

    return { success: true, data: caseRecord };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create case';
    return { success: false, error: message };
  }
}
