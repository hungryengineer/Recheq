import type PgBoss from 'pg-boss';
import { eq, sql } from 'drizzle-orm';
import type { EmployerWorkflowJob } from './job-types.js';
import { createDb } from '../db/client.js';
import { employerRequests } from '../db/schema/employer-requests.js';
import { publishJob } from './pgboss.js';
import type { EventInput } from '@tieout/schema';

export interface EmployerRemindersDeps {
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<unknown>;
  };
}

import { AuditService } from '../audit/audit-service.js';
import { DbAuditRepository } from '../audit/db-audit-repository.js';

let db: ReturnType<typeof createDb>;

export async function processEmployerWorkflowJob(
  jobs: PgBoss.Job[],
  deps?: EmployerRemindersDeps,
): Promise<void> {
  for (const job of jobs) {
    const data = job.data as unknown as EmployerWorkflowJob;

    console.log('processing employer workflow job', { id: job.id, ...data });

    if (!db) db = createDb(process.env.DATABASE_URL!);

    const audit = deps?.audit || new AuditService(new DbAuditRepository(db));

    let publishPayload: {
      queue: string;
      data: Record<string, unknown>;
      options: { delaySeconds: number };
    } | null = null;
    let retries = 0;
    let success = false;

    while (!success && retries < 3) {
      try {
        await db.transaction(async (tx) => {
          const requests = await tx
            .select()
            .from(employerRequests)
            .where(eq(employerRequests.id, data.employerRequestId))
            .limit(1);

          if (requests.length === 0) {
            console.warn('Employer request not found, skipping job', {
              employerRequestId: data.employerRequestId,
            });
            return;
          }

          const request = requests[0];
          if (!request) return;

          if (request.status !== 'pending') {
            console.log('Employer request already responded, short-circuiting reminders', {
              employerRequestId: data.employerRequestId,
            });
            return;
          }

          console.log(
            `[Email Mock] Sending reminder ${data.reminderIndex} for request ${request.id}`,
          );

          await tx
            .update(employerRequests)
            .set({ reminder_count: sql`${employerRequests.reminder_count} + 1` })
            .where(eq(employerRequests.id, request.id));

          await audit.appendEvent(tx, {
            case_id: data.caseId,
            kind: 'employer_reminder_sent',
            payload: {
              employer_request_id: request.id,
              employer_email: request.employer_email,
              reminder_index: data.reminderIndex,
            },
            actor: 'system',
          });

          if (data.reminderIndex < 3) {
            const isDemo = process.env.DEMO_MODE === 'true';
            const delaySeconds = isDemo ? 3 : 24 * 3600;

            publishPayload = {
              queue: 'employer_workflow',
              data: {
                caseId: data.caseId,
                employerRequestId: request.id,
                reminderIndex: data.reminderIndex + 1,
              },
              options: { delaySeconds },
            };
          }
        });
        success = true;
      } catch (e) {
        if (e instanceof Error && 'code' in e && e.code === '23505') {
          retries++;
          console.log(`Concurrent audit append conflict, retrying transaction (${retries}/3)`);
        } else {
          throw e;
        }
      }
    }

    if (publishPayload && success) {
      await publishJob(publishPayload.queue, publishPayload.data, publishPayload.options);
    }
  }
}
