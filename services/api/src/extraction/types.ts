import type { PayslipExtraction, Form16Extraction } from '@recheq/schema';

export type ExtractionStatus = 'pending' | 'completed' | 'failed';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ExtractionMetadata {
  modelId: string;
  schemaVersion: string;
}

export interface ExtractionResult<T extends PayslipExtraction | Form16Extraction> {
  extractedData: T | null;
  metadata: ExtractionMetadata;
  tokenUsage?: TokenUsage;
  status: ExtractionStatus;
  errorMessage?: string;
}
