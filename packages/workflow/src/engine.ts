import type { VerificationStep, StepContext, StepResult } from './types.js';

export interface EngineResult {
  verdict: 'verified' | 'verified_with_notes' | 'needs_review' | 'insufficient_evidence';
  steps: (StepResult & { id: string })[];
}

/** Maximum number of steps executing concurrently (R1.4 / RCQ-121). */
const MAX_CONCURRENCY = 4;

export class Engine {
  private readonly byId = new Map<string, VerificationStep>();

  constructor(private steps: VerificationStep[]) {
    this.validate();
  }

  /**
   * Validates the workflow before execution: step IDs must be unique, every
   * declared dependency must reference a known step, and the dependency graph
   * must be acyclic.
   */
  private validate() {
    const seen = new Set<string>();
    for (const step of this.steps) {
      if (seen.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`);
      }
      seen.add(step.id);
      this.byId.set(step.id, step);
    }

    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        if (!this.byId.has(dep)) {
          throw new Error(`Step ${step.id} declares unknown dependency ${dep}`);
        }
      }
    }

    this.detectCycles();
  }

  private detectCycles() {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string) => {
      if (recStack.has(node)) throw new Error(`Cycle detected involving step ${node}`);
      if (visited.has(node)) return;

      visited.add(node);
      recStack.add(node);

      const neighbors = this.byId.get(node)?.dependsOn ?? [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
      recStack.delete(node);
    };

    for (const step of this.steps) {
      if (!visited.has(step.id)) dfs(step.id);
    }
  }

  async run(ctx: StepContext): Promise<EngineResult> {
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

    // Fast path: bounded-concurrency pool; run() resolves at the fast boundary.
    await this.runPool([...fastIds], (id) => executeStep(id));

    // Slow steps are scheduled independently of the fast path (R1.14) and are
    // not awaited here; the interim verdict is computed without them (R1.6).
    for (const id of this.steps.filter((s) => s.speed === 'slow').map((s) => s.id)) {
      void executeStep(id).catch(() => undefined);
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
    const anyValid = fastResults.some(
      (s) => s.state === 'succeeded' || s.state === 'awaiting_external',
    );

    return {
      verdict: anyValid ? 'verified' : 'insufficient_evidence',
      steps: stepsArray,
    };
  }

  /** Runs `worker` over `ids` with at most MAX_CONCURRENCY concurrent tasks. */
  private async runPool(ids: string[], worker: (id: string) => Promise<unknown>) {
    let next = 0;
    const runners = Array.from({ length: Math.min(MAX_CONCURRENCY, ids.length) }, async () => {
      while (next < ids.length) {
        const id = ids[next];
        next += 1;
        if (id === undefined) break;
        await worker(id);
      }
    });
    await Promise.all(runners);
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

    if (!step.requires(ctx)) {
      const res = notAssessed('Requirements not met');
      results.set(stepId, res);
      return res;
    }

    const startedAt = new Date();
    try {
      const res = await this.runWithTimeout(step, ctx, startedAt);
      results.set(stepId, res);
      return res;
    } catch {
      // Candidate-safe reason only - internal error text must never leak
      // into EngineResult.steps (R2.2).
      const res = failed(startedAt);
      results.set(stepId, res);
      return res;
    }
  }

  /** Enforces the step's declared deadline via AbortController (R1.11). */
  private async runWithTimeout(
    step: VerificationStep,
    ctx: StepContext,
    startedAt: Date,
  ): Promise<StepResult> {
    const controller = new AbortController();
    let deadlineExceeded = false;

    const deadline = new Promise<never>((_, reject) => {
      setTimeout(() => {
        deadlineExceeded = true;
        controller.abort();
        reject(new Error(`Step ${step.id} exceeded its ${step.timeoutMs}ms deadline`));
      }, step.timeoutMs);
    });

    try {
      return await Promise.race([step.run({ ...ctx, signal: controller.signal }), deadline]);
    } catch (err) {
      if (deadlineExceeded) {
        return {
          state: 'timed_out',
          artifact: null,
          reason: null,
          provenance: { source: 'derived', model: null, licence: 'none' },
          startedAt,
          completedAt: new Date(),
        };
      }
      throw err;
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
