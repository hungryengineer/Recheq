import { describe, it, expect } from 'vitest';
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
  it('computes insufficient_evidence on empty step list', async () => {
    const engine = new Engine([]);
    const result = await engine.run({ caseId: '123' });
    expect(result.verdict).toBe('insufficient_evidence');
  });

  it('marks step not_assessed if requires() is false (P3)', async () => {
    const step = new FakeStep('s1', 'Step 1', 'fast', 1000, [], undefined, () => false);
    const engine = new Engine([step]);
    const result = await engine.run({ caseId: '123' });
    expect(result.steps[0]?.state).toBe('not_assessed');
    expect(result.verdict).toBe('insufficient_evidence');
  });

  it('degrades a throwing requires() to failed instead of crashing run() (R2.2)', async () => {
    const step = new FakeStep('s1', 'Throws in requires', 'fast', 1000, [], undefined, () => {
      throw new Error('predicate exploded');
    });
    const healthy = new FakeStep('s2', 'Ok', 'fast', 1000, []);

    const engine = new Engine([step, healthy]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps.find((s) => s.id === 's1')?.state).toBe('failed');
    // Candidate-safe reason only (R2.2).
    expect(result.steps.find((s) => s.id === 's1')?.reason).toBe(
      'This check could not be completed',
    );
    expect(result.steps.find((s) => s.id === 's2')?.state).toBe('succeeded');
  });

  it('rejects a fast step that depends on a slow step at construction (R1.14)', () => {
    const fast = new FakeStep('fast', 'Fast', 'fast', 1000, ['slow']);
    const slowStep = new FakeStep('slow', 'Slow', 'slow', 60000, []);
    expect(() => new Engine([fast, slowStep])).toThrow(
      /Fast step fast cannot depend on slow step slow/,
    );
  });

  it('catches throwing step and marks failed without aborting others', async () => {
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
  });

  it('detects mutual dependency (cycle) at load time', () => {
    const stepA = new FakeStep('a', 'A', 'fast', 1000, ['b']);
    const stepB = new FakeStep('b', 'B', 'fast', 1000, ['a']);
    expect(() => new Engine([stepA, stepB])).toThrow(/Cycle detected/);
  });

  it('marks dependency-of-a-dependency as not_assessed when upstream fails', async () => {
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

    const engine = new Engine([stepFail, stepB, stepC]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps.find((s) => s.id === 'b')?.state).toBe('not_assessed');
    expect(result.steps.find((s) => s.id === 'c')?.state).toBe('not_assessed');
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

  it('runs a shared dependency exactly once when several steps depend on it', async () => {
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

    expect(runs).toBe(1);
    expect(result.steps.find((s) => s.id === 'left')?.state).toBe('succeeded');
    expect(result.steps.find((s) => s.id === 'right')?.state).toBe('succeeded');
  });

  it('enforces timeoutMs: marks the step timed_out and blocks dependents', async () => {
    const slow = new FakeStep(
      'slow',
      'Slow',
      'fast',
      20,
      [],
      undefined,
      () => true,
      async () =>
        new Promise<StepResult>((resolve) => {
          setTimeout(
            () =>
              resolve({
                state: 'succeeded',
                artifact: null,
                reason: null,
                provenance: { source: 'derived', model: null, licence: 'none' },
                startedAt: new Date(),
                completedAt: new Date(),
              }),
            500,
          );
        }),
    );
    const dependent = new FakeStep('dep', 'Dep', 'fast', 1000, ['slow']);

    const engine = new Engine([slow, dependent]);
    const result = await engine.run({ caseId: '123' });

    expect(result.steps.find((s) => s.id === 'slow')?.state).toBe('timed_out');
    expect(result.steps.find((s) => s.id === 'dep')?.state).toBe('not_assessed');
  });

  it('caps concurrent execution at four steps', async () => {
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
          await new Promise((r) => setTimeout(r, 5));
          active -= 1;
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

    const steps = Array.from({ length: 12 }, (_, i) => mk(`s${i}`));
    const result = await new Engine(steps).run({ caseId: '123' });

    expect(maxActive).toBe(4);
    expect(result.verdict).toBe('verified');
  });

  it('reports mixed fast outcomes as verified_with_notes (R1.12)', async () => {
    const ok = new FakeStep('ok', 'Ok', 'fast', 1000, []);
    const bad = new FakeStep(
      'bad',
      'Bad',
      'fast',
      1000,
      [],
      undefined,
      () => true,
      async () => {
        throw new Error('Boom');
      },
    );

    const result = await new Engine([ok, bad]).run({ caseId: '123' });
    expect(result.verdict).toBe('verified_with_notes');
  });

  it('reports needs_review when every fast step failed or timed out', async () => {
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

  it('surfaces slow-step completion through onSlowStepSettled (R1.14)', async () => {
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
    const result = await new Engine([slow]).run(
      { caseId: '123' },
      {
        onSlowStepSettled: (id, res, err) => {
          settled.push({ id, result: res, error: err });
          resolveSettled();
        },
      },
    );

    // run() resolves at the fast boundary before the slow step finishes…
    expect(settled).toHaveLength(0);
    expect(result.steps.find((s) => s.id === 'slow')?.state).toBe('pending');

    // …then the callback delivers the outcome (awaited, no fixed-delay race).
    await firstSettled;
    expect(settled).toHaveLength(1);
    expect(settled[0]?.id).toBe('slow');
    expect(settled[0]?.result?.state).toBe('succeeded');
    expect(settled[0]?.error).toBeNull();
  });
});
