export const runtime = 'nodejs';

import { toHandler } from '@/lib/server/adapter';
import { listWebhooksHandler } from '@recheq/api/src/routes/settings/webhooks/list.js';
import { createWebhookHandler } from '@recheq/api/src/routes/settings/webhooks/create.js';

export const GET = toHandler(listWebhooksHandler);
export const POST = toHandler(createWebhookHandler);