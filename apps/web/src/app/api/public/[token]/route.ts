import { toPublicHandler } from '../../../../lib/server/adapter';
import { getCandidateHandler } from '@tieout/api/src/routes/public/candidate.js';

export const GET = toPublicHandler(getCandidateHandler);
