import { desc, eq } from 'drizzle-orm';
import { ConsentStatus, type ConsentRecord } from '@tieout/schema';
import type { ConsentServiceDeps } from '../services/consent/consent-service.js';
import type { Database } from './client.js';
import { toCaseRecord, getCaseRecordById } from './case-queries.js';
import { cases } from './schema/cases.js';
import { consents } from './schema/consents.js';
import { AuditService } from '../audit/audit-service.js';
import { DbAuditRepository } from '../audit/db-audit-repository.js';
import { transitionCaseStatus } from '../domain/case-status.js';
import { AppError } from '../http/errors.js';

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
 *
 * Error handling:
 * - Each method wraps its DB work in try/catch outside the transaction callback
 *   so the transaction is rolled back before the error is re-thrown.
 * - Errors are re-thrown as AppError with the original as `cause` so callers
 *   receive a consistent typed error.
 */
export function createConsentDeps(db: Database): ConsentServiceDeps {
  const auditRepo = new DbAuditRepository(db);
  const audit = new AuditService(auditRepo);

  return {
    db: {
      getCaseById: (caseId) => getCaseRecordById(db, caseId),

      async updateCaseStatus(caseId, status) {
        try {
          await db.update(cases).set({ status }).where(eq(cases.id, caseId)).execute();
        } catch (cause) {
          throw new AppError(500, 'INTERNAL_ERROR', `Failed to update case status for ${caseId}`, {
            cause,
          });
        }
      },

      /**
       * Inserts the consent record, updates the case status, and appends the
       * audit event — all inside a single transaction.
       */
      async createConsent(input) {
        let result: ConsentRecord | undefined;

        try {
          await db.transaction(async (tx) => {
            // Serialize concurrent consent writes for the same case. Locking the
            // case row FOR UPDATE before the audit append ensures only one
            // transaction at a time computes the seq and status transition; the
            // shared `tx` alone gives atomicity, not serialization.
            const caseRows = await tx
              .select()
              .from(cases)
              .where(eq(cases.id, input.case_id))
              .for('update')
              .limit(1);
            const caseRow = caseRows[0];
            if (!caseRow) {
              throw new AppError(404, 'NOT_FOUND', `Case ${input.case_id} not found`);
            }

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
            let newStatus;
            try {
              newStatus = transitionCaseStatus(toCaseRecord(caseRow).status, 'consent_granted');
            } catch (cause) {
              throw new AppError(
                409,
                'INVALID_STATE_TRANSITION',
                'Consent cannot be granted for this case in its current state',
                { cause },
              );
            }
            await tx.update(cases).set({ status: newStatus }).where(eq(cases.id, input.case_id));

            // Append audit event inside the same transaction so the read and
            // the write share the same snapshot (seq-race prevention). The
            // case row lock above additionally serializes concurrent appends.
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
        } catch (cause) {
          if (cause instanceof AppError) throw cause;
          throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create consent record', { cause });
        }

        if (!result) {
          throw new AppError(
            500,
            'INTERNAL_ERROR',
            'createConsent transaction did not produce a result',
          );
        }
        return result;
      },

      async getConsentByCaseId(caseId) {
        try {
          const rows = await db
            .select()
            .from(consents)
            .where(eq(consents.case_id, caseId))
            .orderBy(desc(consents.created_at))
            .limit(1);
          return rows[0] ? toConsentRecord(rows[0]) : null;
        } catch (cause) {
          throw new AppError(500, 'INTERNAL_ERROR', `Failed to fetch consent for case ${caseId}`, {
            cause,
          });
        }
      },

      /**
       * Updates consent status and appends the withdrawal audit event inside a
       * single transaction.
       */
      async updateConsentStatus(consentId, status, withdrawnAt) {
        try {
          await db.transaction(async (tx) => {
            // Lock the consent row so concurrent withdrawals for the same
            // consent serialize, then lock the case row to serialize the status
            // transition and audit append with the consent-grant path.
            const consentRows = await tx
              .select()
              .from(consents)
              .where(eq(consents.id, consentId))
              .for('update')
              .limit(1);
            const consentRow = consentRows[0];

            if (!consentRow) {
              throw new AppError(404, 'NOT_FOUND', `Consent ${consentId} not found`);
            }

            await tx
              .update(consents)
              .set({ status, withdrawn_at: new Date(withdrawnAt) })
              .where(eq(consents.id, consentId));

            const caseRows = await tx
              .select()
              .from(cases)
              .where(eq(cases.id, consentRow.case_id))
              .for('update')
              .limit(1);
            const caseRow = caseRows[0];
            if (caseRow) {
              let newStatus;
              try {
                newStatus = transitionCaseStatus(toCaseRecord(caseRow).status, 'withdrawn');
              } catch (cause) {
                throw new AppError(
                  409,
                  'INVALID_STATE_TRANSITION',
                  'Consent cannot be withdrawn for this case in its current state',
                  { cause },
                );
              }
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
          });
        } catch (cause) {
          if (cause instanceof AppError) throw cause;
          throw new AppError(
            500,
            'INTERNAL_ERROR',
            `Failed to update consent status for ${consentId}`,
            { cause },
          );
        }
      },
    },
    audit: {
      appendEvent: (tx, input) => audit.appendEvent(tx, input),
    },
  };
}
