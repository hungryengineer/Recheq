// ─── Anthropic Provider Implementation ─────────────────────────
// Implementation using Claude API for document extraction

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@recheq/schema';
import { buildPayslipPrompt } from '../prompts/payslip-v1.js';
import { buildForm16Prompt } from '../prompts/form16-v1.js';

interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}

const DEFAULT_CONFIG: AnthropicConfig = {
  apiKey: '',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
  temperature: 0.1,
};

/**
 * Anthropic/Claude provider for document extraction
 */
export class AnthropicExtractor implements LlmDocumentExtractor {
  readonly provider = 'anthropic';
  readonly supportsStreaming = true;

  constructor(private config: AnthropicConfig = DEFAULT_CONFIG) {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
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
      maxContentSize: 5 * 1024 * 1024, // 5MB
      supportsImages: true,
      supportsPdfText: true,
      costPer1kTokens: 0.003, // Claude 3.5 Sonnet input cost
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - attempt to make a minimal API call
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
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
      const prompt =
        documentType === 'payslip'
          ? buildPayslipPrompt(request.documentContent, request.retryContext?.validationError)
          : buildForm16Prompt(request.documentContent, request.retryContext?.validationError);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          system: prompt.system,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt.user,
                },
                // Add image or text content based on document content
                ...this.createContentBlocks(request),
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      rawOutput = data.content?.[0]?.text ?? '';
      usage = {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
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
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  private createContentBlocks(request: ExtractionRequest): Array<Record<string, unknown>> {
    if (request.mimeType.startsWith('image/')) {
      // For images, use image content block
      return [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: request.mimeType,
            data: request.documentContent,
          },
        },
      ];
    } else if (request.mimeType === 'application/pdf' || request.mimeType === 'text/plain') {
      // Per the ExtractionRequest contract, PDFs arrive as pre-extracted plain
      // text (raw Base64 PDF binary is not supported and would be gibberish here).
      return [
        {
          type: 'text',
          text: `Document content (${request.mimeType}):\n${request.documentContent}`,
        },
      ];
    } else {
      // Fallback for other types
      return [
        {
          type: 'text',
          text: `Document content:\n${request.documentContent}`,
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
}

/**
 * Create an Anthropic extractor with the given configuration
 */
export function createAnthropicExtractor(
  config: Partial<AnthropicConfig> = {},
): AnthropicExtractor {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  return new AnthropicExtractor(fullConfig);
}
