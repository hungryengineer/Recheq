import type { CaseProcessingDeps } from '@tieout/api/src/workflows/case-processing.js';

const globalForDeps = globalThis as unknown as {
  deps: CaseProcessingDeps | undefined;
};

import { repository } from './repository';
import { db } from './db';
import { AuditService } from '@tieout/api/src/audit/audit-service.js';
import { DbAuditRepository } from '@tieout/api/src/audit/db-audit-repository.js';
// We don't have real extractor/epfoProvider wired up yet for Phase 2, but we can wire the DB and audit

export function buildDeps(): CaseProcessingDeps {
  if (!globalForDeps.deps) {
    const auditService = new AuditService(
      new DbAuditRepository(db as unknown as ConstructorParameters<typeof DbAuditRepository>[0]),
    );

    globalForDeps.deps = {
      db: repository as unknown as CaseProcessingDeps['db'],
      audit: auditService as unknown as CaseProcessingDeps['audit'],
      epfoProvider: {} as unknown as CaseProcessingDeps['epfoProvider'], // To be implemented if needed
      extractor: {} as unknown as CaseProcessingDeps['extractor'], // To be implemented if needed
    };
  }
  return globalForDeps.deps;
}
