export const runtime = 'nodejs';

import { toPublicHandler } from '@/lib/server/adapter';
import { loginHandler } from '@tieout/api/src/routes/auth/login.js';

export const POST = toPublicHandler(loginHandler);
