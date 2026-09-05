export const runtime = 'nodejs';

import { toHandler } from '@/lib/server/adapter';
import { deleteApiKeyHandler } from '@recheq/api/src/routes/settings/api-keys/delete.js';

export const DELETE = toHandler(deleteApiKeyHandler);
