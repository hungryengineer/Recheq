export const runtime = 'nodejs';

import { toPublicHandler } from '@/lib/server/adapter';
import { ssoHandler } from '@tieout/api/src/routes/auth/sso.js';

export const POST = toPublicHandler(ssoHandler);
