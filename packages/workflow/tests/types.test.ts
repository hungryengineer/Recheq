import { describe, it, expect } from 'vitest';
import type {
  StepState,
  StepResult,
  Provenance,
  DataSourceDeclaration,
  VerificationStep,
  StepContext,
} from '../src/types.js';
import { PROVENANCE_REGISTER } from '../src/types.js';

/** Compile-time helper: forces T to resolve or the file fails to typecheck. */
type Assert<T extends true> = T;

describe('RCQ-20108 — step contract types', () => {
  it('exposes exactly the seven lifecycle states', () => {
    const all: StepState[] = [
      'pending',
      'running',
      'succeeded',
      'failed',
      'timed_out',
      'not_assessed',
      'awaiting_external',
    ];
    // Exhaustive switch: adding/removing a state must break this test.
    const isTotal = (s: StepState): boolean =>
      ({
        pending: true,
        running: true,
        succeeded: true,
        failed: true,
        timed_out: true,
        not_assessed: true,
        awaiting_external: true,
      })[s];
    expect(all.every((s) => isTotal(s))).toBe(true);
    expect(all).toHaveLength(7);
  });

  it('types the artifact through StepResult<T>', async () => {
    // Compile-time: generic instantiation flows into artifact.
    type _StringResult = Assert<
      StepResult<string>['artifact'] extends string | null ? true : false
    >;
    type _UnknownArtifact = Assert<StepResult['artifact'] extends unknown | null ? true : false>;
    type _ProvenanceShape = Assert<StepResult['provenance'] extends Provenance ? true : false>;

    const res: StepResult<string> = {
      state: 'succeeded',
      artifact: 'payslip.pdf',
      reason: null,
      provenance: { source: 'derived', model: null, licence: 'consented' },
      startedAt: new Date(),
      completedAt: new Date(),
    };
    expect(res.artifact).toBe('payslip.pdf');
  });

  it('accepts a minimal step as VerificationStep with default generics', async () => {
    const step: VerificationStep = {
      id: 'identity',
      label: 'Identity consistency',
      speed: 'fast',
      timeoutMs: 5_000,
      dependsOn: [],
      dataSource: { source: 'derived', licence: 'public-api' },
      requires: (ctx) => ctx.caseId.length > 0,
      run: async () => ({
        state: 'succeeded',
        artifact: null,
        reason: null,
        provenance: { source: 'derived', model: null, licence: 'derived' },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    };

    // requires() is synchronous by contract — never a thenable.
    const verdict = step.requires({ caseId: 'case-1' });
    expect(typeof verdict).toBe('boolean');
    expect((verdict as unknown as { then?: unknown }).then).toBeUndefined();

    await expect(step.run({ caseId: 'case-1' })).resolves.toMatchObject({
      state: 'succeeded',
    });
  });

  it('supports typed artifacts via TOut while keeping TIn phantom-safe', async () => {
    interface Payslip {
      netSalary: number;
    }
    const step: VerificationStep<StepContext, 'raw-pdf', Payslip> = {
      id: 'payslip-extract',
      label: 'Payslip extraction',
      speed: 'slow',
      timeoutMs: 30_000,
      dependsOn: ['upload'],
      dataSource: { source: 'derived', licence: 'consented' },
      requires: () => true,
      run: async () => ({
        state: 'succeeded',
        artifact: { netSalary: 100_000 },
        reason: null,
        provenance: { source: 'derived', model: 'gemini-2.5-flash', licence: 'consented' },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    };

    const out = await step.run({ caseId: 'c' });
    // TOut flows through: netSalary is known here without a cast.
    expect(out.artifact?.netSalary).toBe(100_000);

    // TIn flows through ctx.input when a caller supplies the payload.
    const withInput = await step.run({
      caseId: 'c',
      input: 'raw-pdf-bytes' as 'raw-pdf',
    });
    expect(withInput.state).toBe('succeeded');
  });

  it('declares provenance sources in a closed register (R1.15/R1.16)', () => {
    expect([...PROVENANCE_REGISTER].sort()).toEqual([
      'derived',
      'epfo:fixture',
      'epfo:signzy',
      'mca:data.gov.in',
    ]);
  });

  it('keeps DataSourceDeclaration aligned with the register vocabulary', () => {
    const decl: DataSourceDeclaration = { source: 'epfo:signzy', licence: 'licensed' };
    expect(PROVENANCE_REGISTER.has(decl.source)).toBe(true);
    expect(['consented', 'licensed', 'public-api']).toContain(decl.licence);
  });

  it('rejects assigning a narrow step context to a broad step boundary', () => {
    interface NarrowContext extends StepContext {
      extraArg: string;
    }
    const narrowStep: VerificationStep<NarrowContext> = {
      id: 'narrow',
      label: 'Narrow Step',
      speed: 'fast',
      timeoutMs: 1000,
      dependsOn: [],
      dataSource: { source: 'derived', licence: 'none' },
      requires: (ctx: NarrowContext) => ctx.extraArg === 'yes',
      run: async (_ctx: NarrowContext) => ({
        state: 'succeeded',
        artifact: null,
        reason: null,
        provenance: { source: 'derived', model: null, licence: 'none' },
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    };

    // @ts-expect-error Property 'extraArg' is missing in type 'StepContext & { input?: unknown; }' but required in type 'NarrowContext'.
    const _broadStep: VerificationStep<StepContext> = narrowStep;
  });
});
