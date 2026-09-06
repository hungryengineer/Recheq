import { grantConsentHandler, toErrorResponse } from '@recheq/api/web';
import { getConsentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';
import { toPublicHandler } from '@/lib/server/adapter';

export const POST = toPublicHandler(
  async (req: { raw: Request; body: unknown; params: { token: string } }) => {
    const token = req.params.token;
    const request = req.raw;

    // NOTE: toPublicHandler has already read and JSON-parsed the request body.
    // Calling request json method here would throw on an already-consumed stream.
    try {
      const result = await grantConsentHandler(
        {
          params: { token },
          body: req.body,
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
  },
);
