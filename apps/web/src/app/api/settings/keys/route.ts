export const runtime = 'nodejs';

import { toHandler } from '@/lib/server/adapter';
import { listApiKeysHandler } from '@tieout/api/src/routes/settings/api-keys/list.js';
import { createApiKeyHandler } from '@tieout/api/src/routes/settings/api-keys/create.js';

export const GET = toHandler(listApiKeysHandler);
export const POST = toHandler(createApiKeyHandler);
