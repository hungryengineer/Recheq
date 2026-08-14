import { eq, inArray, and } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { documents } from '../db/schema/documents.js';
import { extractions } from '../db/schema/extractions.js';
import { epfoRecords } from '../db/schema/epfo-records.js';
import type { CheckContext } from './check-context.js';
import type { EvidenceOrigin, EvidenceAssembly, PayslipExtraction, Form16Extraction } from '@tieout/schema';
import type { EpfoHistory } from '../epfo/epfo-provider.js';

export async function assembleEvidence(db: Database, caseId: string): Promise<CheckContext> {
  // 1. Fetch all documents for the case to find the Payslip and Form 16
  const docs = await db.select().from(documents).where(eq(documents.case_id, caseId));
  
  const payslipDoc = docs.find((d: { id: string; kind: string }) => d.kind === 'payslip');
  const form16Doc = docs.find((d: { id: string; kind: string }) => d.kind === 'form_16');

  // 2. Fetch successful extractions for these documents
  let payslip: PayslipExtraction | null = null;
  let form16: Form16Extraction | null = null;

  const docIdsToFetch = [payslipDoc?.id, form16Doc?.id].filter(Boolean) as string[];

  if (docIdsToFetch.length > 0) {
    const exts = await db
      .select()
      .from(extractions)
      .where(
        and(
          inArray(extractions.document_id, docIdsToFetch),
          eq(extractions.status, 'completed')
        )
      );

    for (const ext of exts) {
      if (ext.document_id === payslipDoc?.id && ext.extracted_data) {
        payslip = ext.extracted_data as PayslipExtraction;
      } else if (ext.document_id === form16Doc?.id && ext.extracted_data) {
        form16 = ext.extracted_data as Form16Extraction;
      }
    }
  }

  // 3. Fetch completed EPFO record
  const [epfoRec] = await db
    .select()
    .from(epfoRecords)
    .where(
      and(
        eq(epfoRecords.case_id, caseId),
        eq(epfoRecords.status, 'completed')
      )
    );

  const epfoHistory: EpfoHistory | null = epfoRec && epfoRec.employment_history 
    ? (epfoRec.employment_history as unknown as EpfoHistory) 
    : null;

  // 4. Assemble the context
  const origins: EvidenceOrigin[] = [];
  if (payslip) origins.push('payslip');
  if (form16) origins.push('form_16');
  if (epfoHistory) origins.push('epfo');
  // forensics and employer not yet implemented

  const assembly: EvidenceAssembly = {
    case_id: caseId,
    origins,
    has_payslip: !!payslip,
    has_form16: !!form16,
    has_epfo: !!epfoHistory,
    has_employer: false,
    has_forensics: false,
  };

  return {
    assembly,
    payslip,
    form16,
    epfoHistory,
  };
}
