// ─── OpenAI Compatible Provider Implementation ─────────────────
// Implementation using OpenAI API or compatible services (Azure, Groq, etc.)

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import { buildPayslipPrompt } from '../prompts/payslip-v1.js';
import { buildForm16Prompt } from '../prompts/form16-v1.js';
interface OpenAiCompatibleConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  /** Whether to use vision models for image extraction */
  useVision: boolean;
}

const DEFAULT_CONFIG: OpenAiCompatibleConfig = {
  apiKey: '',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  maxTokens: 4096,
  temperature: 0.1,
  useVision: true,
};

/**
 * OpenAI compatible provider for document extraction
 * Works with OpenAI, Azure OpenAI, Groq, and other compatible APIs
 */
export class OpenAiCompatibleExtractor implements LlmDocumentExtractor {
  readonly provider = 'openai-compatible';
  readonly supportsStreaming = true;

  constructor(private config: OpenAiCompatibleConfig = DEFAULT_CONFIG) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    if (!config.baseUrl) {
      throw new Error('Base URL is required');
    }
  }

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    return this.extractDocument(request, 'payslip');
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    return this.extractDocument(request, 'form16');
  }

  getMetadata() {
    return {
      maxContentSize: this.config.useVision ? 20 * 1024 * 1024 : 4 * 1024 * 1024, // Vision supports larger files
      supportsImages: this.config.useVision,
      supportsPdfText: true,
      costPer1kTokens: this.estimateCostPer1kTokens(),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - attempt to list models
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this.createHeaders(),
      });
      return response.status !== 401 && response.status !== 403;
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
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    try {
      const messages = this.createMessages(request, documentType);

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages,
          response_format: { type: 'json_object' }, // Force JSON mode when supported
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      rawOutput = data.choices[0]?.message?.content || '';
      usage = {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      };

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
        data: {} as T,
        rawOutput,
        modelId: this.config.model,
        usage,
        extractionDurationMs: Date.now() - startTime,
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
        retryCount: request.retryContext ? 1 : 0,
      };
    }
  }

  private createHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private createMessages(
    request: ExtractionRequest,
    documentType: 'payslip' | 'form16',
  ): Array<Record<string, unknown>> {
    const isImage = request.mimeType.startsWith('image/');
    // Fallback if vision is disabled for images
    const docTextForPrompt =
      isImage && !this.config.useVision
        ? '[Image content - use text extraction from image first]'
        : isImage
          ? ''
          : request.documentContent;
    const prompt =
      documentType === 'payslip'
        ? buildPayslipPrompt(docTextForPrompt, request.retryContext?.validationError)
        : buildForm16Prompt(docTextForPrompt, request.retryContext?.validationError);

    if (this.config.useVision && isImage) {
      // Vision API format for images
      return [
        {
          role: 'system',
          content: prompt.system,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.user },
            {
              type: 'image_url',
              image_url: {
                url: `data:${request.mimeType};base64,${request.documentContent}`,
              },
            },
          ],
        },
      ];
    } else {
      // Text-based extraction for PDFs and text. Per the ExtractionRequest
      // contract, PDFs arrive as pre-extracted plain text (Chat Completions do
      // not accept raw Base64 PDF binary).
      return [
        {
          role: 'system',
          content: prompt.system,
        },
        {
          role: 'user',
          content: prompt.user,
        },
      ];
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

  private estimateCostPer1kTokens(): number {
    // Rough estimates based on model family
    const model = this.config.model.toLowerCase();

    if (model.includes('gpt-4o')) {
      return 0.005; // GPT-4o mini input cost
    } else if (model.includes('gpt-4')) {
      return 0.03; // GPT-4 input cost
    } else if (model.includes('gpt-3.5')) {
      return 0.0015; // GPT-3.5 input cost
    } else if (model.includes('groq') && model.includes('mixtral')) {
      return 0.00027; // Mixtral 8x7B on Groq
    } else {
      return 0.001; // Default estimate
    }
  }
}

/**
 * Create an OpenAI compatible extractor with the given configuration
 */
export function createOpenAiCompatibleExtractor(
  config: Partial<OpenAiCompatibleConfig> = {},
): OpenAiCompatibleExtractor {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  return new OpenAiCompatibleExtractor(fullConfig);
}

/**
 * Create an OpenAI extractor with default OpenAI settings
 */
export function createOpenAiExtractor(
  apiKey: string,
  model: string = 'gpt-4o-mini',
): OpenAiCompatibleExtractor {
  return createOpenAiCompatibleExtractor({
    apiKey,
    model,
    baseUrl: 'https://api.openai.com/v1',
  });
}

/**
 * Create an Azure OpenAI extractor
 */
export function createAzureOpenAiExtractor(
  apiKey: string,
  deploymentName: string,
  resourceName: string,
  apiVersion: string = '2024-02-01',
): OpenAiCompatibleExtractor {
  return createOpenAiCompatibleExtractor({
    apiKey,
    model: deploymentName,
    baseUrl: `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
  });
}

/**
 * Create a Groq extractor
 */
export function createGroqExtractor(
  apiKey: string,
  model: string = 'mixtral-8x7b-32768',
): OpenAiCompatibleExtractor {
  return createOpenAiCompatibleExtractor({
    apiKey,
    model,
    baseUrl: 'https://api.groq.com/openai/v1',
    useVision: false, // Groq doesn't support vision models
  });
}
