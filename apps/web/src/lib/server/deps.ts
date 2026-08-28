/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CaseProcessingDeps } from '@tieout/api/src/workflows/case-processing.js';
import type { TokenVerifier } from '@tieout/api/src/routes/public/token-auth.js';

export type WebAppDeps = CaseProcessingDeps & { tokenVerifier: TokenVerifier };

declare global {
  var __deps: WebAppDeps | undefined;
}

const globalForDeps = globalThis as {
  __deps: WebAppDeps | undefined;
};

import { repository } from './repository';
import { db } from './db';
import { AuditService } from '@tieout/api/src/audit/audit-service.js';
import { DbAuditRepository } from '@tieout/api/src/audit/db-audit-repository.js';
import { FixtureEpfoProvider } from '@tieout/api/src/epfo/fixture-epfo-provider.js';
import { RegexDocumentExtractor } from '@tieout/api/src/extraction/providers/regex-extractor.js';

import { createTokenVerifier } from '@tieout/api/src/db/token-deps.js';

export function buildDeps(): WebAppDeps {
  if (!globalForDeps.__deps) {
    const auditService = new AuditService(new DbAuditRepository(db));
    const tokenVerifier = createTokenVerifier(db);

    globalForDeps.__deps = {
      db: repository,
      audit: auditService,
      epfoProvider: new FixtureEpfoProvider(),
      extractor: new RegexDocumentExtractor(),
      tokenVerifier,
    } as unknown as WebAppDeps;
  }
  return globalForDeps.__deps;
}
