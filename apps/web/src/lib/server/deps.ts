import type { CaseProcessingDeps } from '@recheq/api/src/workflows/case-processing.js';
import type { TokenVerifier } from '@recheq/api/src/routes/public/token-auth.js';

export type WebAppDeps = CaseProcessingDeps & { tokenVerifier: TokenVerifier };

declare global {
  var __deps: WebAppDeps | undefined;
}

const globalForDeps = globalThis as {
  __deps: WebAppDeps | undefined;
};

import { repository } from './repository';
import { db } from './db';
import { AuditService } from '@recheq/api/src/audit/audit-service.js';
import { DbAuditRepository } from '@recheq/api/src/audit/db-audit-repository.js';
import { FixtureEpfoProvider } from '@recheq/api/src/epfo/fixture-epfo-provider.js';
import { createProductionExtractor } from '@recheq/api/src/extraction/extractor-factory.js';
import { createTokenVerifier } from '@recheq/api/src/db/token-deps.js';
import {
  publishCaseCompletedWebhooks,
  type PublishWebhookDeps,
} from '@recheq/api/src/workflows/webhook-publisher.js';

export function buildDeps(): WebAppDeps {
  if (!globalForDeps.__deps) {
    const auditService = new AuditService(new DbAuditRepository(db));
    const tokenVerifier = createTokenVerifier(db);
    const webhookPublisher: PublishWebhookDeps = { db, canPublish: true };

    const extendedDb = new Proxy(db, {
      get(target, prop) {
        if (prop in repository) {
          return (repository as unknown as Record<string | symbol, unknown>)[prop];
        }
        const val = (target as unknown as Record<string | symbol, unknown>)[prop];
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return val;
      },
    });

    globalForDeps.__deps = {
      db: extendedDb,
      audit: auditService,
      epfoProvider: new FixtureEpfoProvider(),
      extractor: createProductionExtractor(process.env),
      tokenVerifier,
      publishCaseCompletedWebhooks: (
        caseId: string,
        orgId: string,
        payload: {
          verdict: string;
          risk_score: number;
          finding_count: number;
          findings: Array<{ rule_id: string; severity: string; title: string }>;
        },
      ) => publishCaseCompletedWebhooks(caseId, orgId, payload, webhookPublisher),
    } as unknown as WebAppDeps;
  }
  return globalForDeps.__deps;
}
