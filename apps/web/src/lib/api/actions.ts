'use server';

import { revalidatePath } from 'next/cache';
import { CaseCreateInput } from '@tieout/schema';
import type { CaseRecord } from '@tieout/schema';
import { mockCases, delay } from './store';

export async function createCase(rawInput: unknown): Promise<CaseRecord> {
  await delay(500);
  
  // Zod explicitly strips out malicious/unexpected fields, preventing mass assignment
  const input = CaseCreateInput.parse(rawInput);

  const newCase: CaseRecord = {
    ...input,
    id: `case-${Math.random().toString(36).substring(2, 9)}`,
    org_id: 'org-001',
    created_by: 'user-001',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'processing',
    verdict: null,
    risk_score: null,
    uan: input.uan ?? null, // Ensure uan is nullable
  };

  mockCases.unshift(newCase);
  
  // Invalidate the cases page cache so Next.js re-renders the list with the fresh data
  revalidatePath('/cases');
  
  return newCase;
}
