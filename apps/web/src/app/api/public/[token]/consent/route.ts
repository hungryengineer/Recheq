import { toPublicHandler } from '../../../../../lib/server/adapter';
import { grantConsentHandler } from '@tieout/api/src/routes/public/consent.js';

export const POST = toPublicHandler(grantConsentHandler);
