export const EPFO_LOOKUP_COST_INR = {
  low: 10,
  high: 50,
} as const;

export const GEMINI_FLASH_PRICING = {
  inputPer1MUsd: 0.075,
  outputPer1MUsd: 0.3,
  usdToInr: 83,
} as const;

export interface TokenCounts {
  promptTokens: number;
  completionTokens: number;
}

export function computeInferenceCostInr(tokens: TokenCounts): number {
  const inputUsd = (tokens.promptTokens / 1_000_000) * GEMINI_FLASH_PRICING.inputPer1MUsd;
  const outputUsd = (tokens.completionTokens / 1_000_000) * GEMINI_FLASH_PRICING.outputPer1MUsd;

  return (inputUsd + outputUsd) * GEMINI_FLASH_PRICING.usdToInr;
}

export function computeEpfoCostRangeInr(): { low: number; high: number } {
  return { ...EPFO_LOOKUP_COST_INR };
}

export function computeGrossMargin(
  priceInr: number,
  inferenceCostInr: number,
  epfoCostInr: number,
): number {
  if (priceInr <= 0) {
    return 0;
  }

  return (priceInr - inferenceCostInr - epfoCostInr) / priceInr;
}

export interface CaseEconomics {
  inferenceCostInr: number;
  epfoCostLowInr: number;
  epfoCostHighInr: number;
  marginAtPriceLowEpfo: number;
  marginAtPriceHighEpfo: number;
}

export function computeCaseEconomics(tokens: TokenCounts, priceInr: number): CaseEconomics {
  const inferenceCostInr = computeInferenceCostInr(tokens);
  const epfo = computeEpfoCostRangeInr();

  return {
    inferenceCostInr,
    epfoCostLowInr: epfo.low,
    epfoCostHighInr: epfo.high,
    marginAtPriceLowEpfo: computeGrossMargin(priceInr, inferenceCostInr, epfo.low),
    marginAtPriceHighEpfo: computeGrossMargin(priceInr, inferenceCostInr, epfo.high),
  };
}
