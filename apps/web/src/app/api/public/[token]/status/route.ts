import { toPublicHandler } from '../../../../../lib/server/adapter';
import { getStatusHandler } from '@recheq/api/src/routes/public/status.js';

export const GET = toPublicHandler(getStatusHandler);
