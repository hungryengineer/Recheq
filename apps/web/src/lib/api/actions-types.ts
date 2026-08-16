/**
 * Shared types and type guards for Server Action return values.
 * Keep this file free of 'use server' — it must be importable by client components.
 */

export type CreateCaseError = {
  error: {
    code: string;
    message?: string;
    details?: {
      fields?: Array<{ path: string; message: string }>;
    };
  };
};

export type CreateCaseSuccess = {
  candidate_link?: string;
  id?: string;
};

export type CreateCaseResult = CreateCaseSuccess | CreateCaseError;

export function isCreateCaseError(result: CreateCaseResult): result is CreateCaseError {
  return 'error' in result;
}
