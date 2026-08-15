import type { EventInput } from '@tieout/schema';
import { AppError } from '../../http/errors.js';

export interface DisputeServiceDeps {
  db: {
    transaction: <T>(cb: (tx: unknown) => Promise<T>) => Promise<T>;
    getFindingById: (
      tx: unknown,
      findingId: string,
    ) => Promise<{ id: string; case_id: string; status: string } | null>;
    updateFindingStatusAndReason: (
      tx: unknown,
      findingId: string,
      status: string,
      reason: string,
    ) => Promise<void>;
  };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<void>;
  };
}

/**
 * Marks a finding as disputed by the candidate.
 *
 * Validates that the finding belongs to the provided case ID and is currently open.
 * Disputing a finding appends an audit event but does not automatically recompute the verdict.
 */
export async function disputeFinding(
  caseId: string,
  findingId: string,
  reason: string,
  deps: DisputeServiceDeps,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    const finding = await deps.db.getFindingById(tx, findingId);

    if (!finding) {
      throw new AppError(404, 'FINDING_NOT_FOUND', 'Finding not found');
    }

    if (finding.case_id !== caseId) {
      // SECURITY: Ensure candidate can only dispute their own findings
      throw new AppError(403, 'FORBIDDEN', 'Finding does not belong to this case');
    }

    if (finding.status !== 'open') {
      throw new AppError(
        400,
        'INVALID_FINDING_STATUS',
        `Cannot dispute finding with status: ${finding.status}`,
      );
    }

    await deps.db.updateFindingStatusAndReason(tx, findingId, 'disputed', reason);

    await deps.audit.appendEvent(tx, {
      case_id: caseId,
      kind: 'finding_disputed',
      payload: {
        finding_id: findingId,
        reason,
      },
      actor: 'candidate',
    });
  });
}
