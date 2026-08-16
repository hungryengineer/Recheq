export const runtime = 'nodejs';

import { toHandler } from '@/lib/server/adapter';
import { deleteApiKeyHandler } from '@tieout/api/src/routes/settings/api-keys/delete.js';

export const DELETE = toHandler(deleteApiKeyHandler);
