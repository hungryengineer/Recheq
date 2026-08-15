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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDeps(): any {
  if (!globalForDeps.deps) {
    const auditService = new AuditService(
      new DbAuditRepository(db as unknown as ConstructorParameters<typeof DbAuditRepository>[0]),
    );

    const tokenVerifier = {
      verifyAndGetCaseId: async (rawToken: string, _purpose: string) => {
        // Mock token verification for demo/testing
        if (rawToken === 'test-token' || rawToken.startsWith('tie_')) {
          // Just return the first available case for testing if no specific token logic is implemented in db
          const orgId = process.env.DEV_ORG_ID || '00000000-0000-0000-0000-000000000002';
          const cases = await repository.listCasesByOrg(orgId);
          if (cases.length > 0) return cases[0].id;
          throw new Error('No cases found for mock token verification');
        }
        throw new Error('Invalid token');
      }
    };

    globalForDeps.deps = {
      db: repository as unknown as CaseProcessingDeps['db'],
      audit: auditService as unknown as CaseProcessingDeps['audit'],
      epfoProvider: new FixtureEpfoProvider(),
      extractor: new FixtureExtractor(),
      tokenVerifier,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }
  return globalForDeps.deps;
}
