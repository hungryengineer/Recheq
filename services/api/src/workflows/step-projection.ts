/** Minimal document shape accepted from any call site (drizzle or zod). */
export interface DocumentLike {
  id: string;
  kind: string;
  status: string;
  uploaded_at: Date | string;
}

/**
 * Shared per-step status projection (RCQ-20113).
 *
 * Derives the four contract steps [payslip, form16, epfo, rules] from the
 * persisted case state so the public candidate view and the ops case-detail
 * view always agree.
 *
 * R2.2 — every `reason` is candidate-safe: no provider names, no internal
 * error codes, no stack traces. Human summaries are stable product copy.
 */

export type ContractStepId = 'payslip' | 'form16' | 'epfo' | 'rules';

export type StepState =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'not_assessed'
  | 'awaiting_external';

export interface StepEvidence {
  provider: string;
  model_version: string | null;
}

export interface ProjectedStep {
  id: ContractStepId;
  label: string;
  state: StepState;
  started_at: string;
  completed_at: string | null;
  human_summary: string;
  reason: string | null;
}

export type ProjectedOpsStep = ProjectedStep & { evidence: StepEvidence[] };

/** Minimal shape of an extraction row used for evidence/timing. */
export interface ExtractionLike {
  document_id: string;
  status: string;
  model_id?: string | null;
  created_at: Date | string | null;
  completed_at: Date | string | null;
}

export interface StepProjectionInput {
  caseRecord: { status: string };
  /** Real lifecycle anchor used as fallback started_at (never the epoch). */
  caseCreatedAt?: Date | string | undefined;
  documents: DocumentLike[];
  extractions: ExtractionLike[];
  epfoRecords: { employment_history: unknown }[];
}

const STEP_LABELS: Record<ContractStepId, string> = {
  payslip: 'Payslip Processing',
  form16: 'Form 16 Analysis',
  epfo: 'EPFO Verification',
  rules: 'Rule Evaluation',
};

const SUMMARIES: Record<StepState, string> = {
  pending: 'Waiting to start',
  running: 'In progress',
  succeeded: 'Completed successfully',
  failed: 'Could not be completed',
  timed_out: 'Took too long and was stopped',
  not_assessed: 'Not required for this case',
  awaiting_external: 'Waiting on an external source',
};

/** Candidate-safe failure reason per step family (R2.2). */
const FAILURE_REASONS: Record<ContractStepId, string> = {
  payslip: 'Your payslip could not be processed. Please re-upload it or contact support.',
  form16: 'Your Form 16 could not be processed. Please re-upload it or contact support.',
  epfo: 'Employment history could not be verified right now.',
  rules: 'The final checks could not be completed.',
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

interface DocStepInput {
  kind: string;
  documents: DocumentLike[];
  extractions: ExtractionLike[];
  caseStatus: string;
  caseCreatedAt?: Date | string | undefined;
}

/**
 * State machine for document-backed steps (payslip, form16):
 * - no documents -> pending (not_assessed once the case completes without any)
 * - any failed extraction -> failed
 * - all docs extracted successfully -> succeeded
 * - otherwise running while the case is processing
 */
export function deriveDocStep(input: DocStepInput): ProjectedStep {
  const { kind, documents, extractions, caseStatus, caseCreatedAt } = input;
  const docs = documents.filter((d) => d.kind === kind);
  const docIds = new Set(docs.map((d) => d.id));
  const rows = extractions.filter((e) => docIds.has(e.document_id));

  let state: StepState;
  let reason: string | null = null;

  if (docs.length === 0) {
    state =
      caseStatus === 'processing'
        ? 'pending'
        : caseStatus === 'complete'
          ? 'not_assessed'
          : 'pending';
  } else if (rows.some((r) => r.status === 'failed') || docs.some((d) => d.status === 'failed')) {
    state = 'failed';
    reason = FAILURE_REASONS[kind === 'form_16' ? 'form16' : (kind as ContractStepId)];
  } else if (
    docs.every((d) => d.status === 'extracted') &&
    rows.length > 0 &&
    rows.every((r) => r.status === 'success')
  ) {
    state = 'succeeded';
  } else {
    state = caseStatus === 'processing' ? 'running' : 'pending';
  }

  const startedAt = iso(docs[0]?.uploaded_at) ?? iso(caseCreatedAt) ?? new Date().toISOString();
  const doneRows = rows.filter((r) => r.completed_at && r.status !== 'pending');
  const completedAt =
    state === 'succeeded' || state === 'failed'
      ? (iso(doneRows.sort((a, b) => ts(b.completed_at) - ts(a.completed_at))[0]?.completed_at) ??
        null)
      : null;

  return {
    id: kind === 'form_16' ? 'form16' : (kind as ContractStepId),
    label: STEP_LABELS[kind === 'form_16' ? 'form16' : (kind as ContractStepId)],
    state,
    started_at: startedAt,
    completed_at: completedAt,
    human_summary: SUMMARIES[state],
    reason,
  };
}

function ts(value: Date | string | null | undefined): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export interface EpfoStepInput {
  epfoRecords: { employment_history: unknown }[];
  caseStatus: string;
  caseCreatedAt?: Date | string | undefined;
  startedAt?: string | null;
  completedAt?: string | null;
}

export function deriveEpfoStep(input: EpfoStepInput): ProjectedStep {
  const { epfoRecords, caseStatus } = input;
  let state: StepState;
  if (epfoRecords.length > 0) {
    state = 'succeeded';
  } else if (caseStatus === 'processing') {
    state = 'awaiting_external';
  } else if (caseStatus === 'complete') {
    state = 'not_assessed';
  } else {
    state = 'pending';
  }

  return {
    id: 'epfo',
    label: STEP_LABELS.epfo,
    state,
    started_at: input.startedAt ?? iso(input.caseCreatedAt) ?? new Date().toISOString(),
    completed_at: state === 'succeeded' ? (input.completedAt ?? null) : null,
    human_summary: SUMMARIES[state],
    reason: null,
  };
}

export function deriveRulesStep(input: {
  caseStatus: string;
  caseCreatedAt?: Date | string | undefined;
  startedAt?: string | null;
  completedAt?: string | null;
}): ProjectedStep {
  const state: StepState =
    input.caseStatus === 'complete'
      ? 'succeeded'
      : input.caseStatus === 'processing'
        ? 'running'
        : input.caseStatus === 'withdrawn'
          ? 'not_assessed'
          : 'pending';

  return {
    id: 'rules',
    label: STEP_LABELS.rules,
    state,
    started_at: input.startedAt ?? iso(input.caseCreatedAt) ?? new Date().toISOString(),
    completed_at: state === 'succeeded' ? (input.completedAt ?? null) : null,
    human_summary: SUMMARIES[state],
    reason: null,
  };
}

/** Public candidate view: exactly the StatusResponse.steps contract (no evidence). */
export function projectPublicSteps(input: StepProjectionInput): ProjectedStep[] {
  const docInput = {
    documents: input.documents,
    extractions: input.extractions,
    caseStatus: input.caseRecord.status,
    caseCreatedAt: input.caseCreatedAt,
  };
  const steps = [
    deriveDocStep({ kind: 'payslip', ...docInput }),
    deriveDocStep({ kind: 'form_16', ...docInput }),
    deriveEpfoStep({
      epfoRecords: input.epfoRecords,
      caseStatus: input.caseRecord.status,
      caseCreatedAt: input.caseCreatedAt,
    }),
    deriveRulesStep({
      caseStatus: input.caseRecord.status,
      caseCreatedAt: input.caseCreatedAt,
    }),
  ];
  // Defence in depth (P5): strip anything beyond the public contract fields.
  return steps.map((s) => ({
    id: s.id,
    label: s.label,
    state: s.state,
    started_at: s.started_at,
    completed_at: s.completed_at,
    human_summary: s.human_summary,
    reason: s.reason,
  }));
}

/** Map an internal model id to its provider name for ops evidence. */
export function providerFromModelId(modelId: string | null | undefined): string {
  if (!modelId) return 'unknown';
  if (/gemini/i.test(modelId)) return 'google';
  if (/^(gpt|o\d)/i.test(modelId)) return 'openai';
  if (/claude/i.test(modelId)) return 'anthropic';
  return modelId.split(/[-_/]/)[0] || 'unknown';
}

/** Ops view: same steps plus evidence grouped per step (CaseDetail.steps). */
export function projectOpsSteps(input: StepProjectionInput): ProjectedOpsStep[] {
  const base = projectPublicSteps(input);
  const evidenceFor = (id: ContractStepId): StepEvidence[] => {
    if (id === 'payslip' || id === 'form16') {
      const kind = id === 'form16' ? 'form_16' : id;
      const docIds = new Set(input.documents.filter((d) => d.kind === kind).map((d) => d.id));
      return input.extractions
        .filter((e) => docIds.has(e.document_id))
        .map((e) => ({
          provider: providerFromModelId(e.model_id),
          model_version: e.model_id ?? null,
        }));
    }
    if (id === 'epfo')
      return input.epfoRecords.length > 0 ? [{ provider: 'epfo', model_version: null }] : [];
    return [];
  };
  return base.map((s) => ({ ...s, evidence: evidenceFor(s.id) }));
}
