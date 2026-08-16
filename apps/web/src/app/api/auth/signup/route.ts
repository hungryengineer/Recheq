export const runtime = 'nodejs';

import { toPublicHandler } from '@/lib/server/adapter';
import { signupHandler } from '@tieout/api/src/routes/auth/signup.js';

export const POST = toPublicHandler(signupHandler);
