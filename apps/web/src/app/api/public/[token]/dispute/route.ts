import { toPublicHandler } from '../../../../../lib/server/adapter';
import { disputeHandler } from '@recheq/api/src/routes/public/dispute.js';

export const POST = toPublicHandler(disputeHandler);
