import { describe, it, expect, vi, afterEach } from 'vitest';
import { FixtureEpfoProvider } from '../src/epfo/fixture-epfo-provider.js';

describe('Fixture EPFO Provider DEMO_MODE', () => {
  const provider = new FixtureEpfoProvider();
  
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Known UAN returns the fixture regardless of DEMO_MODE', async () => {
    vi.stubEnv('DEMO_MODE', 'false');
    const history1 = await provider.fetchEmploymentHistory('100123456799', 'consent-123');
    expect(history1).not.toBeNull();
    expect(history1?.uan).toBe('100123456799');

    vi.stubEnv('DEMO_MODE', 'true');
    const history2 = await provider.fetchEmploymentHistory('100123456799', 'consent-123');
    expect(history2).not.toBeNull();
  });

  it('Unknown UAN with DEMO_MODE unset/false returns null', async () => {
    vi.stubEnv('DEMO_MODE', 'false');
    const history = await provider.fetchEmploymentHistory('999999999999', 'consent-123');
    expect(history).toBeNull();
  });

  it('Unknown UAN with DEMO_MODE=true returns synthetic history', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    const history = await provider.fetchEmploymentHistory('999999999999', 'consent-123');
    expect(history).not.toBeNull();
    expect(history?.periods?.[0]?.employerName).toBe('Unknown Employer');
  });
});
