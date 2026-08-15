import { CaseSummary } from '@tieout/schema';
import { z } from 'zod';
import { apiClient } from './client';

export async function getCases(): Promise<CaseSummary[]> {
  const result = await apiClient<{ items: unknown[] }>('/cases');
  // Validate with Zod before returning
  return z.array(CaseSummary).parse(result.items);
}

export async function getCaseDetails(id: string): Promise<{
  caseRecord: unknown;
  findings: unknown[];
  notAssessed: string[];
}> {
  // Hit Prism mock directly for case detail
  const result = await apiClient<Record<string, unknown>>(`/cases/${id}`);

  return {
    caseRecord: result,
    findings: (result.findings as unknown[]) || [],
    notAssessed: (result.not_assessed as string[]) || [],
  };
}
