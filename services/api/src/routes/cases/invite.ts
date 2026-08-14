import { TokenPurpose } from '@tieout/schema';
import { TokenService } from '../../tokens/token-service.js';

// This is a stub for the HTTP route handler, since the API framework isn't chosen yet.
// In a real Express/Fastify app, this would be `async function inviteCandidate(req, res)`
export async function createInviteRouteHandler(
  caseId: string, 
  tokenService: TokenService
): Promise<{ inviteUrl: string }> {
  // Tokens for candidates to give consent usually expire in 7 days
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  
  const rawToken = await tokenService.createToken(
    caseId, 
    'consent', 
    SEVEN_DAYS_MS
  );
  
  // The token is appended to the public URL for the candidate to click
  return {
    inviteUrl: `https://app.tieout.dev/c/${rawToken}`
  };
}
