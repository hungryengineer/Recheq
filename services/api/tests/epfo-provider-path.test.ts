import { describe, it, expect } from 'vitest';

// A simple test to ensure the path resolution logic in the fixture provider actually finds the fixtures directory
// even when executed from within the tests directory.
import { FixtureEpfoProvider, findRepoRoot } from '../src/epfo/fixture-epfo-provider.js';

describe('Fixture EPFO Provider Path Resolution', () => {
  it('should successfully instantiate without throwing ENOENT on load', () => {
    // The module is already imported above. If the findRepoRoot logic fails, it will throw an Error
    // at module load time (which would fail this suite).
    const provider = new FixtureEpfoProvider();
    expect(provider).toBeInstanceOf(FixtureEpfoProvider);
  });

  it('should be able to resolve a known fixture if the directory is correct', async () => {
    const provider = new FixtureEpfoProvider();
    // Use the 100000000001 UAN which maps to clean-history.json
    const history = await provider.fetchEmploymentHistory('100000000001', 'consent-123');
    expect(history).not.toBeNull();
    if (history) {
      expect(history.uan).toBe('100000000001');
      expect(history.periods.length).toBeGreaterThan(0);
    }
  });

  it('should return null instead of throwing when no workspace root exists above a directory', () => {
    // A serverless bundle has no pnpm-workspace.yaml on disk. findRepoRoot must
    // not throw at module load, otherwise every adapter-backed API route 500s
    // with an empty body in production.
    expect(findRepoRoot('/')).toBeNull();
    expect(findRepoRoot('/tmp/definitely-not-a-repo')).toBeNull();
  });
});
