export const runtime = 'nodejs';

import { toApiKeyHandler } from '@/lib/server/adapter';
import { listCasesV1Handler } from '@recheq/api/src/routes/v1/cases/list.js';
import { createCaseV1Handler } from '@recheq/api/src/routes/v1/cases/create.js';

export const GET = toApiKeyHandler(listCasesV1Handler);
export const POST = toApiKeyHandler(createCaseV1Handler);
