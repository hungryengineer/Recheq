export const PROVENANCE_REGISTER = new Set(['epfo:signzy', 'mca:data.gov.in', 'derived']);

export type StepState =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'not_assessed'
  | 'awaiting_external';

export interface StepResult<T = unknown> {
  state: StepState;
  artifact: T | null;
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

export interface DataSourceDeclaration {
  source: string;
  licence: string;
}

export interface StepContext {
  caseId: string;
  /** Abort signal fired when the step exceeds its declared timeoutMs (R1.11). */
  signal?: AbortSignal;
  [key: string]: unknown;
}

export interface VerificationStep<TOut = unknown> {
  readonly id: string;
  readonly label: string;
  readonly speed: 'fast' | 'slow';
  readonly timeoutMs: number;
  readonly dependsOn: readonly string[];
  readonly dataSource: DataSourceDeclaration; // R1.16
  requires(ctx: StepContext): boolean; // pure
  run(ctx: StepContext): Promise<StepResult<TOut>>;
}
