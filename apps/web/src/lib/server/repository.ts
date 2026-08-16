import { db } from './db';
import { schema } from '@tieout/api/src/db/client.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import type { CaseStatus } from '@tieout/schema';
import type { CaseRecord, DocumentRecord } from '@tieout/schema';
import type { EpfoHistory, ScorableFinding } from '@tieout/rules';
import { createDocumentStorageFromEnv } from '@tieout/api/src/storage/document-storage.js';

const storage = createDocumentStorageFromEnv();

export const repository = {
  createCase: async (input: Omit<CaseRecord, 'id' | 'created_at' | 'updated_at'>) => {
    const [result] = await db.insert(schema.cases).values(input as any).returning();
    return result;
  },
  listCasesByOrg: async (orgId: string) => {
    const results = await db.query.cases.findMany({
      where: eq(schema.cases.org_id, orgId),
      orderBy: [desc(schema.cases.created_at)],
    });
    return results.map((c) => ({
      id: c.id,
      candidate_name: c.candidate_name,
      employer_name: c.employer_name,
      title: c.title,
      status: c.status,
      verdict: c.verdict,
      risk_score: c.risk_score,
      created_at: c.created_at.toISOString(),
    }));
  },
  getCaseByIdAndOrg: async (caseId: string, orgId: string) => {
    const [result] = await db
      .select()
      .from(schema.cases)
      .where(and(eq(schema.cases.id, caseId), eq(schema.cases.org_id, orgId)));
    return result || null;
  },
  getCaseById: async (caseId: string) => {
    const [result] = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId));
    return result || null;
  },
  updateCaseStatus: async (caseId: string, status: CaseStatus) => {
    await db.update(schema.cases).set({ status }).where(eq(schema.cases.id, caseId));
  },
  updateCaseStatusAndVerdict: async (
    tx: unknown,
    caseId: string,
    status: CaseStatus,
    verdict: string,
    riskScore: number,
  ) => {
    await (tx ? (tx as any) : db)
      .update(schema.cases)
      .set({ status, verdict, risk_score: riskScore })
      .where(eq(schema.cases.id, caseId));
  },
  replaceFindings: async (tx: unknown, caseId: string, findings: ScorableFinding[]) => {
    const trx = tx ? (tx as any) : db;
    await trx.delete(schema.findings).where(eq(schema.findings.case_id, caseId));
    if (findings.length > 0) {
      const records = findings.map((f: any) => ({
        id: f.id,
        case_id: caseId,
        rule_id: f.rule_id,
        severity: f.severity,
        status: f.status,
        title: f.title,
        explanation: f.explanation,
        expected: f.expected || null,
        observed: f.observed || null,
        source_document_ids: f.source_document_ids || [],
      }));
      await trx.insert(schema.findings).values(records);
    }
  },
  createConsent: async (input: typeof schema.consents.$inferInsert) => {
    const [result] = await db.insert(schema.consents).values(input).returning();
    return result;
  },
  getConsentByCaseId: async (caseId: string) => {
    const [result] = await db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.case_id, caseId));
    return result || null;
  },
  getDocumentByCaseAndSha: async (caseId: string, sha256: string) => {
    const [result] = await db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.case_id, caseId), eq(schema.documents.sha256, sha256)));
    return result || null;
  },
  createDocument: async (input: Omit<DocumentRecord, 'uploaded_at'>) => {
    const [result] = await db.insert(schema.documents).values(input).returning();
    return result;
  },
  getDocumentsForCase: async (caseId: string) => {
    return await db.select().from(schema.documents).where(eq(schema.documents.case_id, caseId));
  },
  getDocumentContent: async (documentId: string) => {
    const [doc] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId));
    if (!doc) throw new Error(`Document ${documentId} not found`);
    const buffer = await storage.getObject(doc.storage_path);
    return { content: buffer, mimeType: doc.mime_type };
  },
  createExtraction: async (docId: string, args: { modelId: string; schemaVersion: string }) => {
    const [result] = await db
      .insert(schema.extractions)
      .values({
        document_id: docId,
        model_id: args.modelId,
        schema_version: args.schemaVersion,
        status: 'pending',
      })
      .returning({ id: schema.extractions.id });
    return result.id;
  },
  updateExtractionSuccess: async (id: string, data: unknown, usage: unknown) => {
    await db
      .update(schema.extractions)
      .set({
        status: 'success',
        extracted_data: data,
        token_usage: usage,
      })
      .where(eq(schema.extractions.id, id));
  },
  updateExtractionFailure: async (id: string, error: string) => {
    await db
      .update(schema.extractions)
      .set({
        status: 'failed',
        error_message: error,
      })
      .where(eq(schema.extractions.id, id));
  },
  getSuccessfulExtractions: async (docIds: string[]) => {
    if (docIds.length === 0) return [];
    return await db
      .select()
      .from(schema.extractions)
      .where(
        and(
          inArray(schema.extractions.document_id, docIds),
          eq(schema.extractions.status, 'success'),
        ),
      );
  },
  createPendingRecord: async (caseId: string, consentId: string, uan: string) => {
    const [result] = await db.insert(schema.epfoRecords).values({
      case_id: caseId,
      consent_id: consentId,
      uan: uan,
      status: 'pending',
    } as any).returning({ id: schema.epfoRecords.id } as any);
    return result.id;
  },
  updateRecordSuccess: async (id: string, history: EpfoHistory) => {
    await db
      .update(schema.epfoRecords)
      .set({
        status: 'success',
        raw_data: history as unknown as object,
      } as any)
      .where(eq(schema.epfoRecords.id, id as any));
  },
  updateRecordFailure: async (id: string, error: string) => {
    await db
      .update(schema.epfoRecords)
      .set({
        status: 'error',
        error_message: error,
      } as any)
      .where(eq(schema.epfoRecords.id, id as any));
  },
  getFindingsForCase: async (caseId: string) => {
    return await db.select().from(schema.findings).where(eq(schema.findings.case_id, caseId));
  },
  getCompletedEpfoRecords: async (caseId: string) => {
    return await db
      .select({ employment_history: schema.epfoRecords.employment_history })
      .from(schema.epfoRecords)
      .where(and(eq(schema.epfoRecords.case_id, caseId), eq(schema.epfoRecords.status, 'success')));
  },
  getCompletedForensics: async (_caseId: string) => {
    // Currently no forensics table, return empty array for now as per schema
    return [];
  },
  transaction: async (cb: Parameters<typeof db.transaction>[0]) => {
    return await db.transaction(cb);
  },
};
