import type { VerificationStep, StepContext, StepResult } from './types';

export interface EngineResult {
  verdict: 'verified' | 'verified_with_notes' | 'needs_review' | 'insufficient_evidence';
  steps: (StepResult & { id: string })[];
}

export class Engine {
  constructor(private steps: VerificationStep[]) {
    this.detectCycles();
  }

  private detectCycles() {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const graph = new Map<string, string[]>();

    for (const step of this.steps) {
      graph.set(step.id, [...step.dependsOn]);
    }

    const dfs = (node: string) => {
      if (recStack.has(node)) throw new Error(`Cycle detected involving step ${node}`);
      if (visited.has(node)) return;

      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
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
    const stepById = new Map(this.steps.map((s) => [s.id, s]));

    const executeStep = async (stepId: string): Promise<StepResult> => {
      if (results.has(stepId)) return results.get(stepId)!;

      const step = stepById.get(stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found`);
      }

      // Check dependencies
      for (const dep of step.dependsOn) {
        const depResult = await executeStep(dep);
        if (depResult.state === 'failed' || depResult.state === 'not_assessed') {
          const res: StepResult = {
            state: 'not_assessed',
            artifact: null,
            reason: `Dependency ${dep} did not succeed`,
            provenance: { source: 'derived', model: null, licence: 'none' },
            startedAt: new Date(),
            completedAt: new Date(),
          };
          results.set(stepId, res);
          return res;
        }
      }

      if (!step.requires(ctx)) {
        const res: StepResult = {
          state: 'not_assessed',
          artifact: null,
          reason: 'Requirements not met',
          provenance: { source: 'derived', model: null, licence: 'none' },
          startedAt: new Date(),
          completedAt: new Date(),
        };
        results.set(stepId, res);
        return res;
      }

      try {
        const res = await step.run(ctx);
        results.set(stepId, res);
        return res;
      } catch (err: unknown) {
        const res: StepResult = {
          state: 'failed',
          artifact: null,
          reason: err instanceof Error ? err.message : 'Step failed',
          provenance: { source: 'derived', model: null, licence: 'none' },
          startedAt: new Date(),
          completedAt: new Date(),
        };
        results.set(stepId, res);
        return res;
      }
    };

    await Promise.all(this.steps.map((s) => executeStep(s.id)));

    const stepsArray = Array.from(results.entries()).map(([id, res]) => ({ ...res, id }));
    const anyValid = stepsArray.some(
      (s) => s.state === 'succeeded' || s.state === 'awaiting_external',
    );

    return {
      verdict: anyValid ? 'verified' : 'insufficient_evidence',
      steps: stepsArray,
    };
  }
}
