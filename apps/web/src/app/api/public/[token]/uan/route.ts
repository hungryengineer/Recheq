import { toPublicHandler } from '../../../../../lib/server/adapter';
import { submitUanHandler } from '@recheq/api/src/routes/public/uan.js';

export const POST = toPublicHandler(submitUanHandler);
