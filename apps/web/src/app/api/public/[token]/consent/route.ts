import { grantConsentHandler, toErrorResponse } from '@recheq/api/web';
import { getConsentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';
import { toPublicHandler } from '@/lib/server/adapter';

export const POST = toPublicHandler(async (req: { raw: Request; params: { token: string } }) => {
  const token = req.params.token;
  const request = req.raw;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { success: false, message: 'Invalid request body' } };
  }

  try {
    const result = await grantConsentHandler(
      {
        params: { token },
        body,
        context: createRequestContext(),
        ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? null,
        userAgent: request.headers.get('user-agent'),
      },
      {
        ...getConsentDeps(),
        tokenVerifier: getTokenVerifier(),
      },
    );

    return result;
  } catch (error) {
    return toErrorResponse(error);
  }
});
