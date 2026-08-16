import { desc, eq } from 'drizzle-orm';
import type { ConsentRecord, ConsentStatus } from '@tieout/schema';
import type { ConsentServiceDeps } from '../services/consent/consent-service.js';
import type { Database } from './client.js';
import { getCaseRecordById } from './case-queries.js';
import { cases } from './schema/cases.js';
import { consents } from './schema/consents.js';
import { AuditService } from '../audit/audit-service.js';
import { DbAuditRepository } from '../audit/db-audit-repository.js';

type ConsentRow = typeof consents.$inferSelect;

function toConsentRecord(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    status: row.status as ConsentStatus,
    consent_text: row.consent_text,
    consent_version: row.consent_version,
    granted_at: row.granted_at ? row.granted_at.toISOString() : null,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    withdrawn_at: row.withdrawn_at ? row.withdrawn_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

/**
 * Production adapter that backs the consent service (candidate consent flow)
 * with the real database and hash-chained audit events.
 */
export function createConsentDeps(db: Database): ConsentServiceDeps {
  const audit = new AuditService(new DbAuditRepository(db));

  return {
    db: {
      getCaseById: (caseId) => getCaseRecordById(db, caseId),
      async updateCaseStatus(caseId, status) {
        await db.update(cases).set({ status }).where(eq(cases.id, caseId)).execute();
      },
      async createConsent(input) {
        const [row] = await db
          .insert(consents)
          .values({
            case_id: input.case_id,
            status: input.status,
            consent_text: input.consent_text,
            consent_version: input.consent_version,
            granted_at: new Date(input.granted_at),
            ip_address: input.ip_address,
            user_agent: input.user_agent,
            withdrawn_at: null,
            token_hash: input.token_hash,
          })
          .returning();
        if (!row) {
          throw new Error('createConsent failed: no row returned');
        }
        return toConsentRecord(row);
      },
      async getConsentByCaseId(caseId) {
        const rows = await db
          .select()
          .from(consents)
          .where(eq(consents.case_id, caseId))
          .orderBy(desc(consents.created_at))
          .limit(1);
        return rows[0] ? toConsentRecord(rows[0]) : null;
      },
      async updateConsentStatus(consentId, status, withdrawnAt) {
        await db
          .update(consents)
          .set({ status, withdrawn_at: new Date(withdrawnAt) })
          .where(eq(consents.id, consentId))
          .execute();
      },
    },
    audit: {
      appendEvent: (tx, input) => audit.appendEvent(tx, input),
    },
  };
}
