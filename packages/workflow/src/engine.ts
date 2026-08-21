import {
  type VerificationStep,
  type StepContext,
  type StepResult,
  PROVENANCE_REGISTER,
} from './types.js';

export interface EngineResult {
  verdict: 'verified' | 'verified_with_notes' | 'needs_review' | 'insufficient_evidence';
  steps: (StepResult & { id: string })[];
}

/** Options for {@link Engine.run}. */
export interface EngineRunOptions {
  /**
   * Invoked when a background (slow) step settles — either when it resolves
   * (`result` set) or rejects (`error` set). Slow steps are scheduled behind
   * the fast boundary, so this is the only way their outcome becomes
   * observable to the caller.
   */
  onSlowStepSettled?: (id: string, result: StepResult | null, error: unknown | null) => void;
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
      return { verdict: 'insufficient_evidence', steps: [] };
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
        opts.onSlowStepSettled?.(id, result, error);
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

    // Check if any valid results exist among fast steps
    const anyValid = fastResults.some(
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

    return { verdict, steps: stepsArray };
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
    const deadline = new Promise<never>((_, reject) => {
      setTimeout(() => {
        deadlineExceeded = true;
        controller.abort();
        reject(new Error(`Step ${step.id} exceeded its ${step.timeoutMs}ms deadline`));
      }, step.timeoutMs);
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
