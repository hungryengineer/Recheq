export interface ProcessCaseJob {
  caseId: string;
  triggeredBy: string; // 'candidate' (on submit) or 'verifier' (on reprocess)
}

export interface EmployerWorkflowJob {
  caseId: string;
  employerRequestId: string;
  reminderIndex: number;
}
