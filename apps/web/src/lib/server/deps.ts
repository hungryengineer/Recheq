/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { RegexDocumentExtractor } from '@tieout/api/src/extraction/providers/regex-extractor.js';

import { verifyToken } from '@tieout/api/src/tokens/verify-token.js';
import type { TokenPurpose } from '@tieout/schema';

export function buildDeps(): CaseProcessingDeps {
  if (!globalForDeps.__deps) {
    const auditService = new AuditService(new DbAuditRepository(db));

    const tokenVerifier = {
      verifyAndGetCaseId: async (rawToken: string, purpose: string) => {
        // Fallback for demo/testing mock tokens
        if (
          rawToken.startsWith('test-') ||
          rawToken === 'test-token' ||
          rawToken.startsWith('tie_')
        ) {
          if (rawToken.startsWith('test-') && rawToken !== 'test-token') {
            return rawToken.replace('test-', '');
          }
          const orgId = process.env.DEV_ORG_ID || '00000000-0000-0000-0000-000000000002';
          const cases = await repository.listCasesByOrg(orgId);
          if (cases.length > 0) return cases[0].id;
          throw new Error('No cases found for mock token verification');
        }

        // Real token verification against DB
        const verification = await verifyToken(db, rawToken, purpose as TokenPurpose);
        return verification.caseId;
      },
    };

    globalForDeps.__deps = {
      db: repository,
      audit: auditService,
      epfoProvider: new FixtureEpfoProvider(),
      extractor: new RegexDocumentExtractor(),
      tokenVerifier,
    } as any;
  }
  return globalForDeps.__deps as any;
}
