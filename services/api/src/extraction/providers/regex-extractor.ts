import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../llm-document-extractor.js';
import { ExtractionFailureType } from '../llm-document-extractor.js';

export class RegexDocumentExtractor implements LlmDocumentExtractor {
  readonly provider = 'regex-fast-parser';
  readonly supportsStreaming = false;

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    const text = request.documentContent;
    const startTime = Date.now();

    try {
      // Extract PAN: PAN followed by optional chars and then the PAN format
      const panMatch =
        text.match(/PAN\s*([A-Z]{5}\d{4}[A-Z])/i) || text.match(/([A-Z]{5}\d{4}[A-Z])/);
      const pan = panMatch?.[1] ?? null;

      // Extract TDS: TDS followed by anything not a digit, then the amount
      const tdsMatch = text.match(/TDS[^\d]*([\d,]+\.\d{2})/i);
      const tds = tdsMatch ? parseFloat(tdsMatch[1]!.replace(/,/g, '')) : null;

      // Extract Salary (Net Pay or Gross)
      const netPayMatch = text.match(/NET (?:PAY|SALARY|CREDITED)[^\d]*([\d,]+\.\d{2})/i);
      const salary = netPayMatch ? parseFloat(netPayMatch[1]!.replace(/,/g, '')) : null;

      // Extract Org Name
      const lines = text
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);
      const pvtLtdMatch = lines.find((l: string) => l.toLowerCase().includes('pvt. ltd.'));
      const orgName = pvtLtdMatch ?? lines[0] ?? null;

      const data: PayslipExtraction = {
        employer_name: orgName,
        pan: pan,
        income_tax: tds,
        net_salary: salary,

        // Required by schema but not extracted via regex
        employee_name: null,
        employee_id: null,
        month: null,
        year: null,
        gross_salary: null,
        pf_deduction: null,
        professional_tax: null,
        other_deductions: null,
        total_deductions: null,
        uan: null,
        pf_account_number: null,
        extraction_notes: 'Extracted using regex fast-path',
        schema_version: 'payslip-v1',

        basic: { raw_label: null, amount: null },
        hra: { raw_label: null, amount: null },
        da: { raw_label: null, amount: null },
        special_allowance: { raw_label: null, amount: null },
        other_allowances: [],
      };

      return {
        status: 'success',
        data,
        rawOutput: 'Regex fast-path execution',
        modelId: 'regex',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: Date.now() - startTime,
        retryCount: 0,
      };
    } catch (e) {
      return {
        status: 'failure',
        error: String(e),
        rawOutput: '',
        modelId: 'regex',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: Date.now() - startTime,
        retryCount: 0,
      };
    }
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    // Regex extractor currently only supports Payslips
    return {
      status: 'failure',
      error: 'Form16 regex extraction not implemented',
      rawOutput: '',
      modelId: 'regex',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      extractionDurationMs: 0,
      retryCount: 0,
    };
  }

  getMetadata() {
    return {
      maxContentSize: 50 * 1024 * 1024,
      supportsImages: false,
      supportsPdfText: true,
      costPer1kTokens: 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
