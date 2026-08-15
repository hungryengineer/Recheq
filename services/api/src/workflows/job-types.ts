export interface ProcessCaseJob {
  caseId: string;
  triggeredBy: string; // 'candidate' (on submit) or 'verifier' (on reprocess)
}
