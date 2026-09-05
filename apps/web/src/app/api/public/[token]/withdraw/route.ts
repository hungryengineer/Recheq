import { withdrawConsentHandler, toErrorResponse } from '@recheq/api/web';
import { getConsentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';
import { toPublicHandler } from '@/lib/server/adapter';

export const POST = toPublicHandler(async (req: { raw: Request; params: { token: string } }) => {
  const token = req.params.token;

  try {
    const result = await withdrawConsentHandler(
      {
        params: { token },
        context: createRequestContext(),
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
