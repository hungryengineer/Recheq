import { describe, it, expect, vi } from 'vitest';
import { VerificationStep, StepContext, StepResult, StepState } from '../src/types';
import { Engine } from '../src/engine';

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
      completedAt: new Date()
    })
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
    expect(result.steps[0].state).toBe('not_assessed');
    expect(result.verdict).toBe('insufficient_evidence');
  });

  it('catches throwing step and marks failed without aborting others', async () => {
    const stepFail = new FakeStep('s1', 'Fail', 'fast', 1000, [], undefined, () => true, async () => {
      throw new Error('Boom');
    });
    const stepOk = new FakeStep('s2', 'Ok', 'fast', 1000, []);
    const engine = new Engine([stepFail, stepOk]);
    const result = await engine.run({ caseId: '123' });
    
    expect(result.steps.find(s => s.id === 's1')?.state).toBe('failed');
    expect(result.steps.find(s => s.id === 's2')?.state).toBe('succeeded');
  });

  it('detects mutual dependency (cycle) at load time', () => {
    const stepA = new FakeStep('a', 'A', 'fast', 1000, ['b']);
    const stepB = new FakeStep('b', 'B', 'fast', 1000, ['a']);
    expect(() => new Engine([stepA, stepB])).toThrow(/Cycle detected/);
  });

  it('marks dependency-of-a-dependency as not_assessed when upstream fails', async () => {
    const stepFail = new FakeStep('a', 'Fail', 'fast', 1000, [], undefined, () => true, async () => ({
      state: 'failed',
      artifact: null,
      reason: 'Failed upstream',
      provenance: { source: 'none', model: null, licence: 'none' },
      startedAt: new Date(),
      completedAt: new Date()
    }));
    const stepB = new FakeStep('b', 'B', 'fast', 1000, ['a']);
    
    const engine = new Engine([stepFail, stepB]);
    const result = await engine.run({ caseId: '123' });
    
    expect(result.steps.find(s => s.id === 'b')?.state).toBe('not_assessed');
  });
});
