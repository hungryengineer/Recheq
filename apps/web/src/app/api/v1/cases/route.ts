export const runtime = 'nodejs';

import { toApiKeyHandler } from '@/lib/server/adapter';
import { listCasesV1Handler } from '@recheq/api/src/routes/v1/cases/list.js';

export const GET = toApiKeyHandler(listCasesV1Handler);
