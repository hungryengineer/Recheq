// ─── Ollama Provider Implementation ────────────────────────────
// Implementation using local Ollama server for document extraction

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@recheq/schema';
import { buildPayslipPrompt } from '../prompts/payslip-v1.js';
import { buildForm16Prompt } from '../prompts/form16-v1.js';
interface OllamaConfig {
  baseUrl: string;
  model: string;
  /** Temperature for generation */
  temperature: number;
  /** Number of tokens to generate */
  numPredict: number;
  /** Format to force (e.g., json) */
  format?: 'json';
  /** Whether to keep the model loaded in memory */
  keepAlive?: number;
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2:3b', // Small, fast model good for extraction
  temperature: 0.1,
  numPredict: 4096,
  format: 'json',
  keepAlive: 300, // Keep model loaded for 5 minutes
};

/**
 * Ollama provider for local document extraction
 * Uses locally running Ollama server with open-source models
 */
export class OllamaExtractor implements LlmDocumentExtractor {
  readonly provider = 'ollama';
  readonly supportsStreaming = false;

  constructor(private config: OllamaConfig = DEFAULT_CONFIG) {}

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    return this.extractDocument(request, 'payslip');
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    return this.extractDocument(request, 'form16');
  }

  getMetadata() {
    return {
      maxContentSize: 10 * 1024 * 1024, // 10MB for text extraction
      supportsImages: false, // Ollama vision models are separate
      supportsPdfText: true, // Can process extracted PDF text
      costPer1kTokens: 0, // Free when running locally
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models ?? [];

      // Check if the configured model is available
      return models.some(
        (model: { name: string }) =>
          model.name === this.config.model || model.name.includes(this.config.model),
      );
    } catch {
      return false;
    }
  }

  private async extractDocument<T>(
    request: ExtractionRequest,
    documentType: 'payslip' | 'form16',
  ): Promise<ExtractionResult<T>> {
    const startTime = Date.now();
    let rawOutput = '';

    try {
      const promptObj =
        documentType === 'payslip'
          ? buildPayslipPrompt(request.documentContent, request.retryContext?.validationError)
          : buildForm16Prompt(request.documentContent, request.retryContext?.validationError);

      const fullPrompt = `${promptObj.system}\n\n${promptObj.user}`;

      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.numPredict,
            ...(this.config.format ? { format: this.config.format } : {}),
          },
          ...(this.config.keepAlive ? { keep_alive: this.config.keepAlive } : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as { response?: string };
      rawOutput = data.response ?? '';

      // Ollama doesn't provide token usage in standard API
      const usage = {
        promptTokens: this.estimateTokens(fullPrompt),
        completionTokens: this.estimateTokens(rawOutput),
        totalTokens: 0,
      };
      usage.totalTokens = usage.promptTokens + usage.completionTokens;

      // Parse the JSON response
      const parsedData = this.parseJsonResponse<T>(rawOutput, documentType);

      return {
        data: parsedData,
        rawOutput,
        modelId: this.config.model,
        usage,
        extractionDurationMs: Date.now() - startTime,
        status: 'success',
        retryCount: request.retryContext ? 1 : 0,
      };
    } catch (error) {
      return {
        rawOutput,
        modelId: this.config.model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: Date.now() - startTime,
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
        retryCount: request.retryContext ? 1 : 0,
      };
    }
  }

  private parseJsonResponse<T>(rawOutput: string, documentType: string): T {
    try {
      // Clean the output - sometimes LLMs add markdown code blocks
      let jsonStr = rawOutput.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.substring(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }

      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);

      // Basic validation of structure
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid JSON structure: expected object');
      }

      return parsed as T;
    } catch (error) {
      throw new Error(
        `Failed to parse ${documentType} JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Pull a model if not already available
   */
  async pullModel(modelName?: string): Promise<boolean> {
    const modelToPull = modelName || this.config.model;

    try {
      const response = await fetch(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelToPull,
          stream: false,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models on the Ollama server
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return (data.models ?? []).map((model) => model.name);
    } catch {
      return [];
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName?: string): Promise<unknown> {
    const model = modelName || this.config.model;

    try {
      const response = await fetch(`${this.config.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: model,
        }),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }
}

/**
 * Create an Ollama extractor with the given configuration
 */
export function createOllamaExtractor(config: Partial<OllamaConfig> = {}): OllamaExtractor {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  return new OllamaExtractor(fullConfig);
}

/**
 * Recommended models for document extraction with Ollama
 */
export const RECOMMENDED_OLLAMA_MODELS = {
  // Small, fast models for structured extraction
  FAST_EXTRACTION: ['llama3.2:3b', 'phi3:mini', 'qwen2.5:3b'],

  // Balanced models for accuracy and speed
  BALANCED: ['llama3.1:8b', 'mistral:7b', 'gemma2:9b'],

  // High accuracy models (slower)
  HIGH_ACCURACY: ['llama3.1:70b', 'qwen2.5:32b', 'mixtral:8x22b'],

  // Vision-capable models (for image extraction)
  VISION: ['llava:7b', 'bakllava:7b'],
};

/**
 * Helper to create an Ollama extractor with a recommended model
 */
export function createRecommendedOllamaExtractor(
  modelType: keyof typeof RECOMMENDED_OLLAMA_MODELS = 'FAST_EXTRACTION',
  baseUrl?: string,
): OllamaExtractor {
  const model = RECOMMENDED_OLLAMA_MODELS[modelType][0];
  if (!model) {
    throw new Error(`No recommended model configured for ${modelType}`);
  }
  return createOllamaExtractor({
    model,
    ...(baseUrl ? { baseUrl } : {}),
  });
}
