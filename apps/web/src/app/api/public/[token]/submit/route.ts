import { toPublicHandler } from '../../../../../lib/server/adapter';
import { submitCaseHandler } from '@tieout/api/src/routes/public/submit.js';
import { startProcessing } from '../../../../../lib/server/process';
import { NextResponse, after } from 'next/server';

const baseHandler = toPublicHandler(submitCaseHandler);

export async function POST(request: Request, context: { params: Promise<Record<string, string>> }) {
  // We need to capture the response from the base handler to start processing
  const response = await baseHandler(request, context);

  if (response.status === 202) {
    const data = await response.json();
    if (data.caseId) {
      // Start processing in the background (fire-and-forget) safely using after()
      after(() => {
        startProcessing(data.caseId).catch((err) => {
          console.error('Error starting case processing:', err);
        });
      });

      // Clean up caseId from the response to match openapi contract exactly
      return NextResponse.json({ status: data.status }, { status: 202 });
    }
  }

  return response;
}
