export const runtime = 'nodejs';

import { toApiKeyHandler } from '@/lib/server/adapter';
import { listCasesV1Handler } from '@recheq/api/src/routes/v1/cases/list.js';
import { createCaseV1Handler } from '@recheq/api/src/routes/v1/cases/create.js';

export const GET = toApiKeyHandler(listCasesV1Handler);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = toApiKeyHandler(createCaseV1Handler as any);
