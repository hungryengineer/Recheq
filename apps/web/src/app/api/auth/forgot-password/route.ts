export const runtime = 'nodejs';

import { toPublicHandler } from '@/lib/server/adapter';
import { forgotPasswordHandler } from '@recheq/api/src/routes/auth/forgot-password.js';

export const POST = toPublicHandler(forgotPasswordHandler);
