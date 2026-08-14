// ─── Anthropic Provider Implementation ─────────────────────────
// Implementation using Claude API for document extraction

import type { LlmDocumentExtractor, ExtractionRequest, ExtractionResult } from '../llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';

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
    documentType: 'payslip' | 'form16'
  ): Promise<ExtractionResult<T>> {
    const startTime = Date.now();
    let rawOutput = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    
    try {
      const prompt = this.createExtractionPrompt(request, documentType);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
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

      const data = await response.json();
      rawOutput = data.content[0]?.text || '';
      usage = {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
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
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  private createExtractionPrompt(request: ExtractionRequest, documentType: 'payslip' | 'form16'): string {
    const basePrompt = `Extract the following information from the provided ${documentType} document.

CRITICAL RULES:
1. Return ONLY valid JSON matching the exact schema below
2. For missing or illegible values, use "null" (not 0, not empty string)
3. NEVER calculate or infer arithmetic - only extract printed values
4. Preserve the exact printed label for salary components in the "raw_label" field
5. Include any extraction difficulties in "extraction_notes"

${this.getSchemaTemplate(documentType)}

${request.retryContext ? `Previous attempt failed validation: ${request.retryContext.validationError}` : ''}

Respond with ONLY the JSON object, no explanations.`;

    return basePrompt;
  }

  private getSchemaTemplate(documentType: 'payslip' | 'form16'): string {
    if (documentType === 'payslip') {
      return `Payslip JSON Schema:
{
  "employee_name": "string or null",
  "employer_name": "string or null",
  "month": "string or null",
  "year": "number or null",
  "basic_raw_label": "string or null",
  "basic": "number or null",
  "hra": "number or null",
  "da": "number or null",
  "special_allowance": "number or null",
  "other_allowances": "number or null",
  "gross_salary": "number or null",
  "pf_deduction": "number or null",
  "professional_tax": "number or null",
  "income_tax": "number or null",
  "other_deductions": "number or null",
  "total_deductions": "number or null",
  "net_salary": "number or null",
  "extraction_notes": "string or null"
}`;
    } else {
      return `Form 16 JSON Schema:
{
  "employee_name": "string or null",
  "employer_name": "string or null",
  "pan": "string or null",
  "tan": "string or null",
  "financial_year": "string or null",
  "assessment_year": "string or null",
  "gross_total_income": "number or null",
  "total_tax_deducted": "number or null",
  "total_salary": "number or null",
  "extraction_notes": "string or null"
}`;
    }
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
      // For PDFs and text, use text content
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
      throw new Error(`Failed to parse ${documentType} JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Create an Anthropic extractor with the given configuration
 */
export function createAnthropicExtractor(config: Partial<AnthropicConfig> = {}): AnthropicExtractor {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  return new AnthropicExtractor(fullConfig);
}
