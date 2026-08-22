import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VerificationStep, StepContext, StepResult } from '../src/types.js';
import { Engine } from '../src/engine.js';

class FakeStep implements VerificationStep {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly speed: 'fast' | 'slow',
    public readonly timeoutMs: number,
    public readonly dependsOn: readonly string[],
    public readonly dataSource = { source: 'derived', licence: 'none' },
    private requiresFn: (ctx: StepContext) => boolean = () => true,
    private runFn: (ctx: StepContext) => Promise<StepResult> = async () => ({
      state: 'succeeded',
      artifact: 'test-artifact',
      reason: null,
      provenance: { source: 'derived', model: null, licence: 'none' },
      startedAt: new Date(),
      completedAt: new Date(),
    }),
  ) {}

  requires(ctx: StepContext): boolean {
    return this.requiresFn(ctx);
  }

  run(ctx: StepContext): Promise<StepResult> {
    return this.runFn(ctx);
  }
}

describe('Step Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Empty step list -> insufficient_evidence, not a crash', async () => {
    const engine = new Engine([]);
    const result = await engine.run({ caseId: '123' });
    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.steps).toEqual([]);
  });

  it('All steps not_assessed -> insufficient_evidence, status complete, never failed (R1.12)', async () => {
    const step = new FakeStep('s1', 'Step 1', 'fast', 1000, [], undefined, () => false);
    const engine = new Engine([step]);
    const result = await engine.run({ caseId: '123' });
    expect(result.steps[0]?.state).toBe('not_assessed');
    expect(result.verdict).toBe('insufficient_evidence');
  });

  it('One fast step fails, others succeed -> Verdict from survivors; failed step visible in steps[]', async () => {
    const stepFail = new FakeStep(
      's1',
      'Fail',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => {
        throw new Error('Boom');
      },
    );
    const stepOk = new FakeStep('s2', 'Ok', 'fast', 1000, []);
    const engine = new Engine([stepFail, stepOk]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps.find((s) => s.id === 's1')?.state).toBe('failed');
    expect(result.steps.find((s) => s.id === 's2')?.state).toBe('succeeded');
    // Survivors keep the run usable, but the failure downgrades the verdict (R1.12)
    expect(result.verdict).toBe('verified_with_notes');
  });

  it('Dependency-of-a-dependency fails -> downstream step with not_assessed dependency runs', async () => {
    const stepFail = new FakeStep(
      'a',
      'Fail',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => ({
        state: 'failed',
        artifact: null,
        reason: 'Failed upstream',
        provenance: { source: 'none', model: null, licence: 'none' },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );
    const stepB = new FakeStep('b', 'B', 'fast', 1000, ['a']);
    const stepC = new FakeStep('c', 'C', 'fast', 1000, ['b']);

    // Ensure PROVENANCE_REGISTER validation doesn't throw because stepFail dataSource is derived by default
    const engine = new Engine([stepFail, stepB, stepC]);
    const result = await engine.run({ caseId: '123' });

    const resB = result.steps.find((s) => s.id === 'b');
    const resC = result.steps.find((s) => s.id === 'c');

    expect(resB?.state).toBe('not_assessed');
    expect(resC?.state).toBe('succeeded');
    expect(resB?.reason).toBe('Dependency a did not succeed');
  });

  it('succeeded with null artifact -> Coerced to not_assessed (P3)', async () => {
    const nullStep = new FakeStep(
      'n1',
      'Null',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => ({
        state: 'succeeded',
        artifact: null,
        reason: null,
        provenance: { source: 'derived', model: null, licence: 'none' },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );
    const engine = new Engine([nullStep]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps[0]?.state).toBe('not_assessed');
    expect(result.steps[0]?.reason).toBe('Step succeeded but returned null artifact');
  });

  it('Mutual dependency -> Refuses to start, names both', () => {
    const stepA = new FakeStep('a', 'A', 'fast', 1000, ['b']);
    const stepB = new FakeStep('b', 'B', 'fast', 1000, ['a']);
    expect(() => new Engine([stepA, stepB])).toThrowError(
      'Cycle detected involving steps: a -> b -> a',
    );
  });

  it('Step resolves after its timeout fired -> Late result discarded, timed_out stands', async () => {
    const slow = new FakeStep(
      'slow',
      'Slow',
      'fast',
      50, // 50ms timeout
      [],
      undefined,
      () => true,
      async () =>
        new Promise<StepResult>((resolve) => {
          setTimeout(
            () =>
              resolve({
                state: 'succeeded',
                artifact: 'late-artifact',
                reason: null,
                provenance: { source: 'derived', model: null, licence: 'none' },
                startedAt: new Date(),
                completedAt: new Date(),
              }),
            100, // resolves at 100ms
          );
        }),
    );
    const engine = new Engine([slow]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps[0]?.state).toBe('timed_out');

    // Wait extra to ensure no late overriding
    await new Promise((r) => setTimeout(r, 100));
    expect(result.steps[0]?.state).toBe('timed_out');
  });

  it('Concurrent invocation for one case -> No double-write (inflight promise cache ensures single run)', async () => {
    let runs = 0;
    const shared = new FakeStep(
      'shared',
      'Shared',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 10));
        return {
          state: 'succeeded',
          artifact: 'shared-artifact',
          reason: null,
          provenance: { source: 'derived', model: null, licence: 'none' },
          startedAt: new Date(),
          completedAt: new Date(),
        };
      },
    );
    const left = new FakeStep('left', 'L', 'fast', 1000, ['shared']);
    const right = new FakeStep('right', 'R', 'fast', 1000, ['shared']);

    const engine = new Engine([shared, left, right]);
    const result = await engine.run({ caseId: '123' });

    expect(runs).toBe(1); // Executed only once
    expect(result.steps.find((s) => s.id === 'left')?.state).toBe('succeeded');
    expect(result.steps.find((s) => s.id === 'right')?.state).toBe('succeeded');
  });

  it('Step returns provenance with an undeclared source -> Rejected, marked failed, alert raised', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const step = new FakeStep(
      's1',
      'S1',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => ({
        state: 'succeeded',
        artifact: 'art',
        reason: null,
        provenance: { source: 'unknown-source', model: null, licence: 'none' },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );

    const engine = new Engine([step]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps[0]?.state).toBe('failed');
    expect(consoleSpy).toHaveBeenCalledWith(
      'ALERT: Step s1 returned undeclared provenance source unknown-source',
    );
  });

  it('Refuses to run a step whose dataSource is not in the provenance register (R1.16)', () => {
    const invalidSourceStep = new FakeStep('invalid', 'Invalid', 'fast', 1000, [], {
      source: 'alien-source',
      licence: 'none',
    });
    expect(() => new Engine([invalidSourceStep])).toThrowError(
      'Step invalid declares unknown dataSource: alien-source',
    );
  });

  it('caps concurrent execution at four steps (using semaphore)', async () => {
    let active = 0;
    let maxActive = 0;
    const mk = (id: string) =>
      new FakeStep(
        id,
        id,
        'fast',
        1000,
        [],
        undefined,
        () => true,
        async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 10));
          active -= 1;
          return {
            state: 'succeeded',
            artifact: 'art',
            reason: null,
            provenance: { source: 'derived', model: null, licence: 'none' },
            startedAt: new Date(),
            completedAt: new Date(),
          };
        },
      );

    const steps = Array.from({ length: 12 }, (_, i) => mk(`s${i}`));
    const result = await new Engine(steps).run({ caseId: '123' });

    expect(maxActive).toBe(4);
    expect(result.verdict).toBe('verified');
  });

  it('rejects duplicate step ids and unknown dependencies at construction', () => {
    expect(() => {
      const s = new FakeStep('s1', 'S1', 'fast', 1000, []);
      new Engine([s, new FakeStep('s1', 'Dup', 'fast', 1000, [])]);
    }).toThrow(/Duplicate step id/);

    expect(() => {
      new Engine([new FakeStep('a', 'A', 'fast', 1000, ['missing'])]);
    }).toThrow(/unknown dependency missing/);
  });

  it('returns the interim verdict without waiting for slow steps (R1.6/R1.14)', async () => {
    const quick = new FakeStep('quick', 'Quick', 'fast', 1000, []);
    const slow = new FakeStep(
      'slow',
      'Slow',
      'slow',
      60000,
      [],
      undefined,
      () => true,
      async () =>
        new Promise<StepResult>(() => {
          // never resolves within this test
        }),
    );

    const started = Date.now();
    const result = await new Engine([quick, slow]).run({ caseId: '123' });
    const elapsed = Date.now() - started;

    expect(result.verdict).toBe('verified');
    expect(result.steps.find((s) => s.id === 'quick')?.state).toBe('succeeded');
    expect(result.steps.find((s) => s.id === 'slow')?.state).toBe('pending');
    expect(elapsed).toBeLessThan(1000);
  });

  it('handles requires callback throwing an error by marking the step failed', async () => {
    const errorStep = new FakeStep(
      'err_req',
      'ErrReq',
      'fast',
      1000,
      [],
      undefined,
      () => {
        throw new Error('requires failed randomly');
      },
      async () => ({
        state: 'succeeded',
        artifact: 'art',
        reason: null,
        provenance: { source: 'derived', model: null, licence: 'none' },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );

    const engine = new Engine([errorStep]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps[0]?.state).toBe('failed');
    expect(result.steps[0]?.reason).toBe('This check could not be completed');
  });

  it('keeps semaphore locked for background step when it ignores abort signal after timeout', async () => {
    let active = 0;
    let maxActive = 0;
    const mkSlow = (id: string) =>
      new FakeStep(
        id,
        id,
        'fast',
        50, // very tight timeout
        [],
        undefined,
        () => true,
        async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          // Wait longer than timeout, ignoring the abort signal
          await new Promise((r) => setTimeout(r, 200));
          active -= 1;
          return {
            state: 'succeeded',
            artifact: 'art',
            reason: null,
            provenance: { source: 'derived', model: null, licence: 'none' },
            startedAt: new Date(),
            completedAt: new Date(),
          };
        },
      );

    // Create 10 slow steps.
    // They will all time out at 50ms, resolving the engine run fast.
    // However, they will linger in the background for 200ms.
    // Concurrency must NEVER exceed 4 in the background.
    const steps = Array.from({ length: 10 }, (_, i) => mkSlow(`slow${i}`));
    const engine = new Engine(steps);
    const result = await engine.run({ caseId: '123' });

    // The engine run completes quickly because everything timed out.
    // Every fast step timed out with no successes -> needs_review (R1.12).
    expect(result.verdict).toBe('needs_review');
    expect(result.steps.every((s) => s.state === 'timed_out')).toBe(true);

    // Wait until all background steps are completely finished
    await new Promise((r) => setTimeout(r, 300));

    // Max concurrency must not exceed 4, even across background lingering steps
    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it('reports needs_review when every fast step failed or timed out (R1.12)', async () => {
    const mkFail = (id: string) =>
      new FakeStep(
        id,
        id,
        'fast',
        1000,
        [],
        undefined,
        () => true,
        async () => {
          throw new Error('Boom');
        },
      );

    const result = await new Engine([mkFail('a'), mkFail('b')]).run({ caseId: '123' });
    expect(result.verdict).toBe('needs_review');
  });

  it('rejects a fast step that depends on a slow step at construction (R1.14)', () => {
    const fast = new FakeStep('fast', 'Fast', 'fast', 1000, ['slow']);
    const slowStep = new FakeStep('slow', 'Slow', 'slow', 60000, []);
    expect(() => new Engine([fast, slowStep])).toThrow(
      /Fast step fast cannot depend on slow step slow/,
    );
  });

  it('blocks dependents of a timed-out step as not_assessed', async () => {
    const timeout = new FakeStep(
      'timeout',
      'Timeout',
      'fast',
      30,
      [],
      undefined,
      () => true,
      async () =>
        new Promise<StepResult>(() => {
          // never resolves within this test
        }),
    );
    const dependent = new FakeStep('dep', 'Dep', 'fast', 1000, ['timeout']);

    const result = await new Engine([timeout, dependent]).run({ caseId: '123' });

    expect(result.steps.find((s) => s.id === 'timeout')?.state).toBe('timed_out');
    expect(result.steps.find((s) => s.id === 'dep')?.state).toBe('not_assessed');
  });

  it('surfaces slow-step completion exactly once through onSlowStepSettled (R1.14)', async () => {
    const slow = new FakeStep(
      'slow',
      'Slow',
      'slow',
      60000,
      [],
      undefined,
      () => true,
      async () => {
        await new Promise((r) => setTimeout(r, 20));
        return {
          state: 'succeeded',
          artifact: 'slow-artifact',
          reason: null,
          provenance: { source: 'derived', model: null, licence: 'none' },
          startedAt: new Date(),
          completedAt: new Date(),
        };
      },
    );

    const settled: { id: string; result: StepResult | null; error: unknown | null }[] = [];
    let resolveSettled!: () => void;
    const firstSettled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    await new Engine([slow]).run(
      { caseId: '123' },
      {
        onSlowStepSettled: (id, res, err) => {
          settled.push({ id, result: res, error: err });
          resolveSettled();
        },
      },
    );

    // No settlement before the callback fires…
    expect(settled).toHaveLength(0);

    // …then exactly one delivery with the full payload.
    await firstSettled;
    expect(settled).toHaveLength(1);
    expect(settled[0]?.id).toBe('slow');
    expect(settled[0]?.result?.state).toBe('succeeded');
    expect(settled[0]?.error).toBeNull();

    // No duplicate settlement ever arrives after the step has long resolved.
    await new Promise((r) => setTimeout(r, 100));
    expect(settled).toHaveLength(1);
  });

  it('contains async-observer rejections without unhandled rejections', async () => {
    const slow = new FakeStep(
      'slow',
      'Slow',
      'slow',
      60000,
      [],
      undefined,
      () => true,
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        return {
          state: 'succeeded',
          artifact: null,
          reason: null,
          provenance: { source: 'derived', model: null, licence: 'none' },
          startedAt: new Date(),
          completedAt: new Date(),
        };
      },
    );

    // If the engine failed to contain the observer's rejected promise, vitest
    // reports an unhandled rejection and this test fails.
    let observerInvoked!: () => void;
    const invoked = new Promise<void>((resolve) => {
      observerInvoked = resolve;
    });
    const result = await new Engine([slow]).run(
      { caseId: '123' },
      {
        onSlowStepSettled: async () => {
          observerInvoked();
          throw new Error('observer exploded');
        },
      },
    );

    expect(result.steps.find((s) => s.id === 'slow')?.state).toBe('pending');

    // Prove the observer was actually entered, then yield event-loop turns so
    // vitest can report an unhandled rejection if containment is broken.
    await invoked;
    await new Promise((r) => setTimeout(r, 50));
  });
  it('records input tokens, output tokens, model id, and computes INR cost per case', async () => {
    const step1 = new FakeStep(
      's1',
      'Step1',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => ({
        state: 'succeeded',
        artifact: 'art',
        reason: null,
        provenance: {
          source: 'derived',
          model: 'gemini-2.5-flash',
          licence: 'none',
          inputTokens: 1000,
          outputTokens: 200,
        },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );
    const step2 = new FakeStep(
      's2',
      'Step2',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => ({
        state: 'succeeded',
        artifact: 'art',
        reason: null,
        provenance: {
          source: 'derived',
          model: 'gemini-2.5-flash',
          licence: 'none',
          inputTokens: 500,
          outputTokens: 100,
        },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );

    const engine = new Engine([step1, step2]);
    const result = await engine.run({ caseId: '123' });

    expect(result.cost).toBeDefined();
    expect(result.cost.totalInputTokens).toBe(1500);
    expect(result.cost.totalOutputTokens).toBe(300);
    expect(result.cost.modelsUsed).toEqual(['gemini-2.5-flash']);

    // (1500 / 1_000_000) * 6.225 + (300 / 1_000_000) * 24.9
    // = 0.0093375 + 0.00747
    // = 0.0168075
    expect(result.cost.computedInr).toBeCloseTo(0.0168075, 7);
  });

  it('rejects invalid negative, fractional, or infinite tokens from aggregation', async () => {
    const invalidStep = new FakeStep(
      's1',
      'Step1',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => ({
        state: 'succeeded',
        artifact: 'art',
        reason: null,
        provenance: {
          source: 'derived',
          model: 'gemini-2.5-flash',
          licence: 'none',
          inputTokens: -500, // Negative
          outputTokens: 10.5, // Fractional
        },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );
    const validStep = new FakeStep(
      's2',
      'Step2',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => ({
        state: 'succeeded',
        artifact: 'art',
        reason: null,
        provenance: {
          source: 'derived',
          model: 'gemini-2.5-flash',
          licence: 'none',
          inputTokens: Infinity, // Infinite
          outputTokens: 100, // Valid
        },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    );

    const engine = new Engine([invalidStep, validStep]);
    const result = await engine.run({ caseId: '123' });

    expect(result.cost).toBeDefined();
    expect(result.cost.totalInputTokens).toBe(0); // -500 and Infinity are filtered
    expect(result.cost.totalOutputTokens).toBe(100); // 10.5 is filtered, 100 is valid
  });
});
