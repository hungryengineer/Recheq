import { toHandler } from '../../../lib/server/adapter';
import { createCaseHandler } from '@tieout/api/src/routes/cases/create.js';
import { listCasesHandler } from '@tieout/api/src/routes/cases/list.js';

export const runtime = 'nodejs';

export const POST = toHandler(createCaseHandler);
export const GET = toHandler(listCasesHandler);
