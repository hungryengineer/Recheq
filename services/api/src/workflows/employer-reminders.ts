import type PgBoss from 'pg-boss';
import { eq } from 'drizzle-orm';
import type { EmployerWorkflowJob } from './job-types.js';
import { createDb } from '../db/client.js';
import { employerRequests } from '../db/schema/employer-requests.js';
import { publishJob } from './pgboss.js';
import type { EventInput } from '@tieout/schema';

export interface EmployerRemindersDeps {
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<void>;
  };
}

let db: ReturnType<typeof createDb>;

export async function processEmployerWorkflowJob(
  jobs: PgBoss.Job[],
  deps: EmployerRemindersDeps,
): Promise<void> {
  for (const job of jobs) {
    const data = job.data as unknown as EmployerWorkflowJob;

    console.log('processing employer workflow job', { id: job.id, ...data });

    if (!db) db = createDb(process.env.DATABASE_URL!);

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

      // Short-circuit if already responded or no longer pending
      if (request.status !== 'pending') {
        console.log('Employer request already responded, short-circuiting reminders', {
          employerRequestId: data.employerRequestId,
        });
        return;
      }

      // Log email sending
      console.log(
        `[Email Mock] Sending reminder ${data.reminderIndex} to ${request.employer_email}`,
      );

      // Increment reminder count
      await tx
        .update(employerRequests)
        .set({ reminder_count: request.reminder_count + 1 })
        .where(eq(employerRequests.id, request.id));

      await deps.audit.appendEvent(tx, {
        case_id: data.caseId,
        kind: 'employer_reminder_sent',
        payload: {
          employer_request_id: request.id,
          employer_email: request.employer_email,
          reminder_index: data.reminderIndex,
        },
        actor: 'system',
      });

      // Schedule next reminder if < 3
      if (data.reminderIndex < 3) {
        const isDemo = process.env.DEMO_MODE === 'true';
        const delaySeconds = isDemo ? 3 : 24 * 3600; // 24h between reminders (total 48, 72, 96)

        await publishJob(
          'EMPLOYER_WORKFLOW',
          {
            caseId: data.caseId,
            employerRequestId: request.id,
            reminderIndex: data.reminderIndex + 1,
          },
          { delaySeconds },
        );
      }
    });
  }
}
