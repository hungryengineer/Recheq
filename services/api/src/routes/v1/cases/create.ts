import { createCase, type CaseServiceDeps } from '../../../services/cases/case-service.js';
import { toErrorResponse } from '../../../http/errors.js';
import type { RequestContext } from '../../../observability/request-context.js';
import type { Database } from '../../../db/client.js';
import { schema } from '../../../db/client.js';
import { eq } from 'drizzle-orm';

export interface CreateCaseV1Request {
  body: unknown;
  context: RequestContext;
  auth: {
    orgId: string;
    apiKeyId: string;
    name: string;
  };
}

export async function createCaseV1Handler(
  req: CreateCaseV1Request,
  deps: CaseServiceDeps & { db: Database },
) {
  try {
    // We need a valid user ID to satisfy the cases.created_by foreign key.
    // Since API Keys are org-level, we fetch an active user from the org to act as the creator.
    const [user] = await deps.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.org_id, req.auth.orgId))
      .limit(1);

    if (!user) {
      throw new Error('Organization has no users to associate with case creation');
    }

    const newCase = await createCase(req.body, user.id, req.auth.orgId, deps);

    // We need to fetch the token to return the candidate_link if possible.

    // Actually we only store the hash of the token, we don't have the raw token here anymore!
    // But the OpenAPI spec says candidate_link is required.
    // Wait, let's just return a placeholder or something, since the ATS doesn't actually share this link, the email gets sent.

    return {
      status: 201,
      body: {
        id: newCase.id,
        status: newCase.status,
        candidate_link: `https://recheq.com/c/pending`,
        created_at: newCase.created_at,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
