export const runtime = 'nodejs';

import { toPublicHandler } from '@/lib/server/adapter';
import { resetPasswordHandler } from '@recheq/api/src/routes/auth/reset-password.js';

export const POST = toPublicHandler(resetPasswordHandler);
