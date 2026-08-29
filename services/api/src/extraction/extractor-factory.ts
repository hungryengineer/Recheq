// ─── Production extractor factory ────────────────────────────────
// Chooses the best available document extractor at runtime based on env:
//   1. OpenAI-compatible (OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL)
//   2. Gemini (GEMINI_API_KEY / EXTRACTION_MODEL)
//   3. Deterministic regex (always available)
//
// LLM providers are wrapped in SchemaRetryWrapper (one retry with the
// validation error as context) and RegexFallbackExtractor so a hard
// provider failure degrades to regex instead of blanking the case.

import type { LlmDocumentExtractor } from './llm-document-extractor.js';
import { createOpenAiCompatibleExtractor } from './providers/openai-compatible-extractor.js';
import { createGeminiExtractor } from './providers/gemini-extractor.js';
import { RegexDocumentExtractor } from './providers/regex-extractor.js';
import { RegexFallbackExtractor } from './providers/regex-fallback-extractor.js';
import { withSchemaRetry } from './schema-retry.js';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Build the production extractor from environment variables.
 *
 * Never throws: if no LLM credentials are configured it returns the
 * deterministic regex extractor so extraction always has a fallback.
 */
export function createProductionExtractor(
  env: NodeJS.ProcessEnv = process.env,
): LlmDocumentExtractor {
  const openAiKey = env.OPENAI_API_KEY;
  if (openAiKey) {
    const base = createOpenAiCompatibleExtractor({
      apiKey: openAiKey,
      baseUrl: env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL,
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    });
    return new RegexFallbackExtractor(withSchemaRetry(base));
  }

  const geminiKey = env.GEMINI_API_KEY;
  if (geminiKey) {
    const gemini = createGeminiExtractor({
      apiKey: geminiKey,
      ...(env.EXTRACTION_MODEL ? { model: env.EXTRACTION_MODEL } : {}),
    });
    return new RegexFallbackExtractor(withSchemaRetry(gemini));
  }

  return new RegexDocumentExtractor();
}
