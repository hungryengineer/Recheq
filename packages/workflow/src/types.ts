export const PROVENANCE_REGISTER = new Set([
  'epfo:signzy',
  'epfo:fixture',
  'mca:data.gov.in',
  'derived',
]);

/**
 * Lifecycle states a verification step can report (RCQ-20108).
 *
 * - `pending` — scheduled but not started (e.g. behind the fast boundary)
 * - `running` — currently executing
 * - `succeeded` — completed successfully with an artifact
 * - `failed` — errored; `reason` stays candidate-safe
 * - `timed_out` — exceeded its declared `timeoutMs`
 * - `not_assessed` — skipped (requirements unmet or upstream failure)
 * - `awaiting_external` — waiting on an outside actor (employer, EPFO)
 */
export type StepState =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'not_assessed'
  | 'awaiting_external';

/**
 * Provenance of a step's evidence (R1.15 — "the diligence field").
 *
 * Every result must be attributable to where its data came from and under
 * which licence it may be used.
 */
export interface Provenance {
  /** Canonical source id, e.g. 'epfo:signzy' | 'mca:data.gov.in' | 'derived'. */
  source: string;
  /** Extracting model, e.g. 'gemini-2.5-flash', or null for non-model steps. */
  model: string | null;
  /** One of 'consented' | 'licensed' | 'public-api'. */
  licence: string;
}

/** Result of a single verification step (RCQ-20108). */
export interface StepResult<T = unknown> {
  state: StepState;
  artifact: T | null;
  /** Candidate-safe, never internal error text. */
  reason: string | null; // candidate-safe, never internal
  provenance: {
    // R1.15 - the diligence field
    source: string; // 'epfo:signzy' | 'mca:data.gov.in' | 'derived'
    model: string | null; // 'gemini-2.5-flash' | null
    licence: string; // 'consented' | 'licensed' | 'public-api'
    inputTokens?: number;
    outputTokens?: number;
  };
  startedAt: Date;
  completedAt: Date | null;
}

/** Declaration of the external data source a step relies on (R1.16). */
export interface DataSourceDeclaration {
  source: string;
  licence: string;
}

/** Shared execution context handed to every step. */
export interface StepContext {
  caseId: string;
  /** Abort signal fired when the step exceeds its declared timeoutMs (R1.11). */
  signal?: AbortSignal;
  [key: string]: unknown;
}

/**
 * An error thrown by a step to indicate a transient failure (e.g. rate limit, provider outage)
 * that should abort the workflow and trigger a job retry, rather than failing the step and continuing.
 */
export class RecoverableWorkflowError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RecoverableWorkflowError';
  }
}

/**
 * A single unit of the verification workflow (RCQ-20108 contract).
 *
 * I/O contract:
 * - `run()` is the ONLY method permitted to perform I/O (network, DB, FS).
 * - `requires()` must be pure: synchronous, deterministic, free of side
 *   effects, and safe to call multiple times. The engine treats a thrown
 *   `requires()` as a failed step (R2.2), never a crash.
 *
 * Generics:
 * - `TCtx` types the execution context.
 * - `TOut` types the produced artifact (`StepResult<TOut>`).
 * - `TIn` types the optional input payload a step may consume via
 *   `ctx.input`. The engine never sets it in v1; it exists so typed wiring
 *   can be added later without a breaking rename.
 */
export interface VerificationStep<
  TCtx extends StepContext = StepContext,
  TIn = unknown,
  TOut = unknown,
> {
  readonly id: string;
  readonly label: string;
  readonly speed: 'fast' | 'slow';
  readonly timeoutMs: number;
  readonly dependsOn: readonly string[];
  readonly dataSource: DataSourceDeclaration; // R1.16
  requires: (ctx: TCtx) => boolean; // pure
  run: (ctx: TCtx & { input?: TIn }) => Promise<StepResult<TOut>>;
}
