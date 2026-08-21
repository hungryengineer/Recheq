import {
  type VerificationStep,
  type StepContext,
  type StepResult,
  PROVENANCE_REGISTER,
} from './types.js';

export interface EngineResult {
  verdict: 'verified' | 'verified_with_notes' | 'needs_review' | 'insufficient_evidence';
  steps: (StepResult & { id: string })[];
  cost: {
    totalInputTokens: number;
    totalOutputTokens: number;
    modelsUsed: string[];
    computedInr: number;
  };
}

/** Options for {@link Engine.run}. */
export interface EngineRunOptions {
  /**
   * Invoked when a background (slow) step settles. Slow steps are scheduled
   * behind the fast boundary, so this is the only way their outcome becomes
   * observable to the caller.
   *
   * Contract (mirrors `execute()` failure semantics):
   * - A step whose `run()` throws or rejects is delivered as a normal result:
   *   `(id, failedResult, null)` with `result.state === 'failed'`.
   * - `error` is reserved for unexpected engine-level rejections (faults in
   *   the engine itself), which should never occur in normal operation.
   *
   * Observer faults are contained: a throwing callback, or one that returns a
   * rejected promise, must not produce an unhandled rejection after run().
   */
  onSlowStepSettled?: (
    id: string,
    result: StepResult | null,
    error: unknown | null,
  ) => void | Promise<void>;
}

/** Maximum number of steps executing concurrently (R1.4 / RCQ-121). */
const MAX_CONCURRENCY = 4;

class Semaphore {
  private count = 0;
  private queue: (() => void)[] = [];
  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.count < this.max) {
      this.count++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.count--;
    }
  }
}

export class Engine {
  private readonly byId = new Map<string, VerificationStep>();
  private semaphore = new Semaphore(MAX_CONCURRENCY);

  constructor(private steps: VerificationStep[]) {
    this.validate();
  }

  /**
   * Validates the workflow before execution: step IDs must be unique, every
   * declared dependency must reference a known step, the dependency graph
   * must be acyclic, and data sources must be declared in the provenance register.
   */
  private validate() {
    const seen = new Set<string>();
    for (const step of this.steps) {
      if (seen.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`);
      }
      if (!PROVENANCE_REGISTER.has(step.dataSource.source)) {
        throw new Error(`Step ${step.id} declares unknown dataSource: ${step.dataSource.source}`);
      }
      seen.add(step.id);
      this.byId.set(step.id, step);
    }

    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        const depStep = this.byId.get(dep);
        if (!depStep) {
          throw new Error(`Step ${step.id} declares unknown dependency ${dep}`);
        }
        // A fast step awaiting a slow dependency would block the fast-path
        // boundary (R1.14), so the edge is rejected up front.
        if (step.speed === 'fast' && depStep.speed === 'slow') {
          throw new Error(`Fast step ${step.id} cannot depend on slow step ${dep}`);
        }
      }
    }

    this.detectCycles();
  }

  private detectCycles() {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      if (recStack.has(node)) {
        const cycleStartIndex = path.indexOf(node);
        const cyclePath = path.slice(cycleStartIndex).concat(node);
        throw new Error(`Cycle detected involving steps: ${cyclePath.join(' -> ')}`);
      }
      if (visited.has(node)) return;

      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = this.byId.get(node)?.dependsOn ?? [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      path.pop();
      recStack.delete(node);
    };

    for (const step of this.steps) {
      if (!visited.has(step.id)) dfs(step.id);
    }
  }

  async run(ctx: StepContext, opts: EngineRunOptions = {}): Promise<EngineResult> {
    if (this.steps.length === 0) {
      return {
        verdict: 'insufficient_evidence',
        steps: [],
        cost: { totalInputTokens: 0, totalOutputTokens: 0, modelsUsed: [], computedInr: 0 },
      };
    }

    const results = new Map<string, StepResult>();
    // In-flight promise cache so a shared dependency executes exactly once,
    // even when several dependents start concurrently.
    const inflight = new Map<string, Promise<StepResult>>();

    const executeStep = (stepId: string): Promise<StepResult> => {
      const done = results.get(stepId);
      if (done) return Promise.resolve(done);

      const running = inflight.get(stepId);
      if (running) return running;

      const p = this.execute(stepId, ctx, results, executeStep).finally(() => {
        inflight.delete(stepId);
      });
      inflight.set(stepId, p);
      return p;
    };

    const fastIds = new Set(this.steps.filter((s) => s.speed === 'fast').map((s) => s.id));

    // Fast path: start resolving all fast steps. Concurrency limit is enforced inside `execute` via semaphore.
    await Promise.all([...fastIds].map((id) => executeStep(id)));

    // Slow steps are scheduled independently of the fast path (R1.14) and are
    // not awaited here; the interim verdict is computed without them (R1.6).
    // Their outcomes surface through onSlowStepSettled instead of being
    // silently discarded. The observer itself is fault-contained: a throwing
    // callback must not become an unhandled rejection after run() returned.
    const notifySlowStepSettled = (
      id: string,
      result: StepResult | null,
      error: unknown | null,
    ) => {
      try {
        // The observer may be async; a rejected promise must not escape as an
        // unhandled rejection after run() has returned.
        const observed = opts.onSlowStepSettled?.(id, result, error);
        if (observed instanceof Promise && typeof observed.catch === 'function') {
          observed.catch(() => undefined);
        }
      } catch {
        // Observer failures are non-fatal by contract; swallow deliberately.
      }
    };

    for (const id of this.steps.filter((s) => s.speed === 'slow').map((s) => s.id)) {
      void executeStep(id).then(
        (res) => notifySlowStepSettled(id, res, null),
        (err) => notifySlowStepSettled(id, null, err),
      );
    }

    const stepsArray = this.steps.map((s) => {
      const res = results.get(s.id);
      if (res) return { ...res, id: s.id };
      // Slow steps still in flight surface as pending in the interim result.
      return {
        id: s.id,
        state: 'pending' as const,
        artifact: null,
        reason: null,
        provenance: { source: 'derived', model: null, licence: 'none' },
        startedAt: new Date(),
        completedAt: null,
      };
    });

    const fastResults = stepsArray.filter((s) => fastIds.has(s.id));

    // Interim verdict aggregates every terminal state of the fast steps
    // (R1.12): a failure must never silently upgrade the verdict.
    const good = fastResults.filter(
      (s) => s.state === 'succeeded' || s.state === 'awaiting_external',
    ).length;
    const bad = fastResults.filter((s) => s.state === 'failed' || s.state === 'timed_out').length;

    let verdict: EngineResult['verdict'];
    if (good > 0 && bad === 0) {
      verdict = 'verified';
    } else if (good > 0 && bad > 0) {
      verdict = 'verified_with_notes';
    } else if (bad > 0) {
      verdict = 'needs_review';
    } else {
      verdict = 'insufficient_evidence';
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const modelsUsed = new Set<string>();

    for (const s of stepsArray) {
      if (s.provenance.model) modelsUsed.add(s.provenance.model);
      if (s.provenance.inputTokens) totalInputTokens += s.provenance.inputTokens;
      if (s.provenance.outputTokens) totalOutputTokens += s.provenance.outputTokens;
    }

    // Gemini 1.5 Flash rates at $0.075/1M in, $0.30/1M out. Assuming 1 USD = 83 INR.
    // INR 6.225 per 1M input, INR 24.9 per 1M output
    const computedInr =
      (totalInputTokens / 1_000_000) * 6.225 + (totalOutputTokens / 1_000_000) * 24.9;

    return {
      verdict,
      steps: stepsArray,
      cost: {
        totalInputTokens,
        totalOutputTokens,
        modelsUsed: Array.from(modelsUsed),
        computedInr,
      },
    };
  }

  private async execute(
    stepId: string,
    ctx: StepContext,
    results: Map<string, StepResult>,
    executeStep: (id: string) => Promise<StepResult>,
  ): Promise<StepResult> {
    const step = this.byId.get(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    // Dependency gate: any non-succeeded dependency blocks this step (P3).
    for (const dep of step.dependsOn) {
      const depResult = await executeStep(dep);
      if (depResult.state !== 'succeeded') {
        const res = notAssessed(`Dependency ${dep} did not succeed`);
        results.set(stepId, res);
        return res;
      }
    }

    let requiresMet: boolean;
    try {
      requiresMet = step.requires(ctx);
    } catch {
      const res = failed(new Date());
      results.set(stepId, res);
      return res;
    }

    if (!requiresMet) {
      const res = notAssessed('Requirements not met');
      results.set(stepId, res);
      return res;
    }

    // Acquire concurrency lock only after dependencies are resolved
    await this.semaphore.acquire();
    const startedAt = new Date();
    const controller = new AbortController();

    const rawPromise = step.run({ ...ctx, signal: controller.signal });
    // Ensure semaphore is always released exactly once when the step finishes
    // and suppress the rejection from bubbling up to UnhandledRejection
    rawPromise.finally(() => this.semaphore.release()).catch(() => {});

    let deadlineExceeded = false;
    let rejectDeadline!: (err: Error) => void;
    const deadline = new Promise<never>((_, rej) => {
      rejectDeadline = rej;
    });

    const timer = setTimeout(() => {
      deadlineExceeded = true;
      controller.abort();
      rejectDeadline(new Error(`Step ${step.id} exceeded its ${step.timeoutMs}ms deadline`));
    }, step.timeoutMs);

    try {
      let res = await Promise.race([rawPromise, deadline]);

      // Coerce null artifact to not_assessed (P3)
      if (res.state === 'succeeded' && res.artifact === null) {
        res = notAssessed('Step succeeded but returned null artifact');
      }

      // Validate returned provenance
      if (res.state === 'succeeded' && !PROVENANCE_REGISTER.has(res.provenance.source)) {
        console.error(
          `ALERT: Step ${step.id} returned undeclared provenance source ${res.provenance.source}`,
        );
        res = failed(startedAt);
      }

      results.set(stepId, res);
      return res;
    } catch {
      if (deadlineExceeded) {
        const res: StepResult = {
          state: 'timed_out',
          artifact: null,
          reason: null,
          provenance: { source: 'derived', model: null, licence: 'none' },
          startedAt,
          completedAt: new Date(),
        };
        results.set(stepId, res);
        return res;
      }
      // Candidate-safe reason only - internal error text must never leak
      // into EngineResult.steps (R2.2).
      const res = failed(startedAt);
      results.set(stepId, res);
      return res;
    } finally {
      // Clear the deadline when the step wins the race so the rejection is
      // never raised (and never becomes an unhandled rejection).
      clearTimeout(timer);
    }
  }
}

function notAssessed(reason: string): StepResult {
  return {
    state: 'not_assessed',
    artifact: null,
    reason,
    provenance: { source: 'derived', model: null, licence: 'none' },
    startedAt: new Date(),
    completedAt: new Date(),
  };
}

function failed(startedAt: Date): StepResult {
  return {
    state: 'failed',
    artifact: null,
    reason: 'This check could not be completed',
    provenance: { source: 'derived', model: null, licence: 'none' },
    startedAt,
    completedAt: new Date(),
  };
}
