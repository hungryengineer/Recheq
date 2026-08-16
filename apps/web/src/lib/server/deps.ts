import type { CaseProcessingDeps } from '@tieout/api/src/workflows/case-processing.js';

declare global {
  var __deps: CaseProcessingDeps | undefined;
}

const globalForDeps = globalThis as {
  __deps: CaseProcessingDeps | undefined;
};

import { repository } from './repository';
import { db } from './db';
import { AuditService } from '@tieout/api/src/audit/audit-service.js';
import { DbAuditRepository } from '@tieout/api/src/audit/db-audit-repository.js';
import { FixtureEpfoProvider } from '@tieout/api/src/epfo/fixture-epfo-provider.js';
import { FixtureExtractor } from '@tieout/api/src/extraction/fixture-extractor.js';

export function buildDeps(): CaseProcessingDeps {
  if (!globalForDeps.__deps) {
    const auditService = new AuditService(new DbAuditRepository(db));

    const tokenVerifier = {
      verifyAndGetCaseId: async (rawToken: string, _purpose: string) => {
        // Mock token verification for demo/testing
        if (rawToken.startsWith('test-')) {
          const extractedId = rawToken.replace('test-', '');
          if (extractedId !== 'token') return extractedId;
        }
        if (rawToken === 'test-token' || rawToken.startsWith('tie_')) {
          // Just return the first available case for testing if no specific token logic is implemented in db
          const orgId = process.env.DEV_ORG_ID || '00000000-0000-0000-0000-000000000002';
          const cases = await repository.listCasesByOrg(orgId);
          if (cases.length > 0) return cases[0].id;
          throw new Error('No cases found for mock token verification');
        }
        throw new Error('Invalid token');
      },
    };

    globalForDeps.__deps = {
      db: repository,
      audit: auditService,
      epfoProvider: new FixtureEpfoProvider(),
      extractor: new FixtureExtractor(),
      tokenVerifier,
    } as any;
  }
  return globalForDeps.__deps as any;
}
