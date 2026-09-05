import { describe, expect, it } from 'vitest';
import {
  computeCaseEconomics,
  computeEpfoCostRangeInr,
  computeGrossMargin,
  computeInferenceCostInr,
  EPFO_LOOKUP_COST_INR,
} from '../lib/unit-economics.js';

describe('unit-economics', () => {
  it('computeInferenceCostInr uses measured avg input/output tokens', () => {
    const cost = computeInferenceCostInr({ promptTokens: 15000, completionTokens: 1500 });
    expect(cost).toBeCloseTo(0.13, 2);
  });

  it('computeEpfoCostInr returns range 10–50 INR', () => {
    expect(computeEpfoCostRangeInr()).toEqual(EPFO_LOOKUP_COST_INR);
  });

  it('computeGrossMargin at 99 INR price subtracts inference + EPFO separately', () => {
    const margin = computeGrossMargin(99, 0.13, 50);
    expect(margin).toBeCloseTo((99 - 0.13 - 50) / 99, 4);
  });

  it('at 99 INR with EPFO=50 and inference≈0.13, margin is ~49% not ~98%', () => {
    const economics = computeCaseEconomics({ promptTokens: 15000, completionTokens: 1500 }, 99);
    expect(economics.marginAtPriceHighEpfo).toBeCloseTo(0.49, 2);
    expect(economics.marginAtPriceHighEpfo).toBeLessThan(0.6);
  });
});
