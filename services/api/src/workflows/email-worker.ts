import sendgrid from '@sendgrid/mail';
import { z } from 'zod';
import type PgBoss from 'pg-boss';

const EmailDeliveryPayload = z.object({
  to_email: z.string().email(),
  candidate_name: z.string(),
  employer_name: z.string(),
  upload_token: z.string(),
});

type EmailDeliveryJob = z.infer<typeof EmailDeliveryPayload>;

export async function processEmailDelivery(jobs: PgBoss.Job<EmailDeliveryJob>[]): Promise<void> {
  for (const job of jobs) {
    const parsed = EmailDeliveryPayload.safeParse(job.data);

    if (!parsed.success) {
      console.error('Invalid email delivery payload', {
        jobId: job.id,
        errors: parsed.error.errors,
      });
      // We throw to let PgBoss handle the failure and potential retries,
      // though validation errors won't resolve on retry.
      throw new Error('Invalid email delivery payload');
    }

    const { to_email, candidate_name, employer_name, upload_token } = parsed.data;

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      // SECURITY: Fail hard if the API key is not configured, so the job stays in the queue and retries later.
      throw new Error('SENDGRID_API_KEY is not configured');
    }

    sendgrid.setApiKey(apiKey);

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@recheq.com';

    // Construct the document upload link
    // Expects NEXT_PUBLIC_APP_URL to be set (e.g. http://localhost:3000 or https://recheq.com)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const uploadLink = `${appUrl}/c/${upload_token}/upload`;

    const msg = {
      to: to_email,
      from: fromEmail,
      subject: `Action Required: Document Upload for ${employer_name}`,
      text: `Hello ${candidate_name},\n\nPlease upload the required documents for your background check with ${employer_name}.\n\nYou can securely upload your documents using the following link:\n${uploadLink}\n\nThank you,\nThe Recheq Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Action Required: Document Upload</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #18181b; padding: 30px 40px; text-align: left;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Recheq</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #3f3f46;">
                Hello <strong>${candidate_name}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px; color: #3f3f46;">
                You have been requested to upload the required documents for your background check with <strong>${employer_name}</strong>.
              </p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${uploadLink}" style="display: inline-block; padding: 14px 28px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">Upload Documents</a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; line-height: 1.6; margin-top: 30px; color: #71717a;">
                If the button above doesn't work, you can copy and paste the following link into your browser:
                <br>
                <a href="${uploadLink}" style="color: #0ea5e9; word-break: break-all;">${uploadLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 20px 40px; border-top: 1px solid #e4e4e7; text-align: left;">
              <p style="font-size: 14px; color: #a1a1aa; margin: 0;">
                Thank you,<br>The Recheq Team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    try {
      await sendgrid.send(msg);
      console.log('Email delivered successfully', { jobId: job.id, to: to_email });
    } catch (error) {
      console.error('Failed to send email via SendGrid', {
        jobId: job.id,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
}
