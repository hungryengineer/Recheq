import { toPublicHandler } from '../../../../../lib/server/adapter';
import { getStatusHandler } from '@tieout/api/src/routes/public/status.js';

export const GET = toPublicHandler(getStatusHandler);
