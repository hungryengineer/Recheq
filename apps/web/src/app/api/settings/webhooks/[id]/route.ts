export const runtime = 'nodejs';

import { toHandler } from '@/lib/server/adapter';
import { deleteWebhookHandler } from '@recheq/api/src/routes/settings/webhooks/delete.js';

export const DELETE = toHandler(deleteWebhookHandler);