import type { CaseProcessingDeps } from '@tieout/api/src/workflows/case-processing.js';

const globalForDeps = globalThis as unknown as {
  deps: CaseProcessingDeps | undefined;
};

import { repository } from './repository';
import { db } from './db';
import { AuditService } from '@tieout/api/src/audit/audit-service.js';
import { DbAuditRepository } from '@tieout/api/src/audit/db-audit-repository.js';
import { FixtureEpfoProvider } from '@tieout/api/src/epfo/fixture-epfo-provider.js';
import { FixtureExtractor } from '@tieout/api/src/extraction/fixture-extractor.js';

export function buildDeps(): CaseProcessingDeps {
  if (!globalForDeps.deps) {
    const auditService = new AuditService(
      new DbAuditRepository(db as unknown as ConstructorParameters<typeof DbAuditRepository>[0]),
    );

    globalForDeps.deps = {
      db: repository as unknown as CaseProcessingDeps['db'],
      audit: auditService as unknown as CaseProcessingDeps['audit'],
      epfoProvider: new FixtureEpfoProvider(),
      extractor: new FixtureExtractor(),
    };
  }
  return globalForDeps.deps;
}
