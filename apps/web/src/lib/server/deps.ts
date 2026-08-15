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
    const auditService = new AuditService(new DbAuditRepository(db as any));
    
    globalForDeps.deps = {
      db: repository as any,
      audit: auditService as any,
      epfoProvider: {} as any, // To be implemented if needed
      extractor: {} as any,    // To be implemented if needed
    } as any; 
  }
  return globalForDeps.deps;
}
