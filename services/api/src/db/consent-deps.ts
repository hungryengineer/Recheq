import { desc, eq } from 'drizzle-orm';
import { ConsentStatus, type ConsentRecord } from '@tieout/schema';
import type { ConsentServiceDeps } from '../services/consent/consent-service.js';
import type { Database } from './client.js';
import { toCaseRecord, getCaseRecordById } from './case-queries.js';
import { cases } from './schema/cases.js';
import { consents } from './schema/consents.js';
import { AuditService } from '../audit/audit-service.js';
import { DbAuditRepository } from '../audit/db-audit-repository.js';

type ConsentRow = typeof consents.$inferSelect;

function toConsentRecord(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    status: ConsentStatus.parse(row.status),
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
 *
 * Transactional consistency:
 * - `createConsent` executes the consent insert, case-status update, and audit
 *   append inside a single Drizzle transaction. The audit repository receives
 *   the transaction handle so all three writes commit or roll back together.
 * - `updateConsentStatus` (withdraw flow) does the same: status update + audit
 *   append are wrapped in one transaction.
 */
export function createConsentDeps(db: Database): ConsentServiceDeps {
  const auditRepo = new DbAuditRepository(db);
  const audit = new AuditService(auditRepo);

  return {
    db: {
      getCaseById: (caseId) => getCaseRecordById(db, caseId),

      /**
       * Updates the case status. Called by the service layer before/after
       * createConsent — kept as a standalone operation because the service
       * calls it outside the consent-write boundary (e.g. pre-flight check).
       */
      async updateCaseStatus(caseId, status) {
        await db.update(cases).set({ status }).where(eq(cases.id, caseId)).execute();
      },

      /**
       * Inserts the consent record, updates the case status, and appends the
       * audit event — all inside a single transaction.
       */
      async createConsent(input) {
        let result: ConsentRecord | undefined;

        await db.transaction(async (tx) => {
          const [row] = await tx
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

          // Transition case status inside the same transaction.
          const caseRows = await tx
            .select()
            .from(cases)
            .where(eq(cases.id, input.case_id))
            .limit(1);
          const caseRow = caseRows[0];
          if (caseRow) {
            const { transitionCaseStatus } = await import('../domain/case-status.js');
            const newStatus = transitionCaseStatus(
              toCaseRecord(caseRow).status,
              'consent_granted',
            );
            await tx.update(cases).set({ status: newStatus }).where(eq(cases.id, input.case_id));
          }

          // Append audit event inside the same transaction.
          await audit.appendEvent(tx, {
            case_id: input.case_id,
            kind: 'consent_granted',
            payload: {
              consent_id: row.id,
              consent_version: input.consent_version,
            },
            actor: 'candidate',
          });

          result = toConsentRecord(row);
        });

        if (!result) {
          throw new Error('createConsent transaction did not produce a result');
        }
        return result;
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

      /**
       * Updates consent status and appends the withdrawal audit event inside a
       * single transaction.
       */
      async updateConsentStatus(consentId, status, withdrawnAt) {
        await db.transaction(async (tx) => {
          // Fetch the consent row to get case_id for the status update.
          const consentRows = await tx
            .select()
            .from(consents)
            .where(eq(consents.id, consentId))
            .limit(1);
          const consentRow = consentRows[0];

          await tx
            .update(consents)
            .set({ status, withdrawn_at: new Date(withdrawnAt) })
            .where(eq(consents.id, consentId));

          if (consentRow) {
            // Transition case status inside the same transaction.
            const caseRows = await tx
              .select()
              .from(cases)
              .where(eq(cases.id, consentRow.case_id))
              .limit(1);
            const caseRow = caseRows[0];
            if (caseRow) {
              const { transitionCaseStatus } = await import('../domain/case-status.js');
              const newStatus = transitionCaseStatus(toCaseRecord(caseRow).status, 'withdrawn');
              await tx
                .update(cases)
                .set({ status: newStatus })
                .where(eq(cases.id, consentRow.case_id));
            }

            await audit.appendEvent(tx, {
              case_id: consentRow.case_id,
              kind: 'consent_withdrawn',
              payload: {
                consent_id: consentId,
                withdrawn_at: withdrawnAt,
              },
              actor: 'candidate',
            });
          }
        });
      },
    },
    audit: {
      appendEvent: (tx, input) => audit.appendEvent(tx, input),
    },
  };
}
