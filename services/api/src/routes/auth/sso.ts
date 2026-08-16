import { AppError } from '../../http/errors.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ssoHandler(): Promise<{ status: number; body: any }> {
  // SSO not fully implemented in this phase
  throw new AppError(501, 'NOT_IMPLEMENTED', 'SSO Login is not yet implemented');
}
