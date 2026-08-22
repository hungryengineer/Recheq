/**
 * Shared types and type guards for Server Action return values.
 * Keep this file free of 'use server' — it must be importable by client components.
 */

export type ActionError = {
  error: {
    code: string;
    message?: string;
    details?: {
      fields?: Array<{ path: string; message: string }>;
    };
  };
};

export type CreateCaseError = ActionError;

export type CreateCaseSuccess = {
  candidate_link?: string;
  id?: string;
};

export type CreateCaseResult = CreateCaseSuccess | CreateCaseError;

export function isCreateCaseError(result: CreateCaseResult): result is CreateCaseError {
  return 'error' in result;
}

export type UpdateCaseSuccess = { message?: string };
export type UpdateCaseResult = UpdateCaseSuccess | CreateCaseError;

export function isUpdateCaseError(result: UpdateCaseResult): result is CreateCaseError {
  return 'error' in result;
}

export function isActionError(result: unknown): result is ActionError {
  return typeof result === 'object' && result !== null && 'error' in (result as Record<string, unknown>);
}
