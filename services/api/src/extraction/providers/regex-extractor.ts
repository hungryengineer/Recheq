import type { PayslipExtraction, Form16Extraction } from '@recheq/schema';
import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../llm-document-extractor.js';

export class RegexDocumentExtractor implements LlmDocumentExtractor {
  readonly provider = 'regex-fast-parser';
  readonly supportsStreaming = false;

  private refuse<T>(error: string): ExtractionResult<T> {
    const base = {
      rawOutput: error,
      modelId: 'regex',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      extractionDurationMs: 0,
      retryCount: 0,
    };
    return { status: 'failure', error, ...base };
  }

  private assertTextExtractable(request: ExtractionRequest): string | null {
    if (request.mimeType.startsWith('image/')) {
      return 'Regex extraction does not support image documents; requires a vision-capable extractor';
    }
    if (isBinaryContent(request.documentContent)) {
      return 'Document content does not appear to be text and cannot be regex-extracted';
    }
    return null;
  }

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    const refusal = this.assertTextExtractable(request);
    if (refusal) return this.refuse(refusal);

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
    const refusal = this.assertTextExtractable(request);
    if (refusal) return this.refuse<Form16Extraction>(refusal);

    const text = request.documentContent;
    const startTime = Date.now();

    try {
      const panMatch =
        text.match(/PAN\s*([A-Z]{5}\d{4}[A-Z])/i) || text.match(/([A-Z]{5}\d{4}[A-Z])/);
      const pan = panMatch?.[1] ?? null;

      const grossMatch =
        text.match(/Gross Salary[^\d]*([\d,]+\.\d{2})/i) ||
        text.match(/Total Salary[^\d]*([\d,]+\.\d{2})/i);
      const gross = grossMatch ? parseFloat(grossMatch[1]!.replace(/,/g, '')) : null;

      const taxMatch =
        text.match(/Tax Payable[^\d]*([\d,]+\.\d{2})/i) ||
        text.match(/Tax Deducted[^\d]*([\d,]+\.\d{2})/i);
      const tax = taxMatch ? parseFloat(taxMatch[1]!.replace(/,/g, '')) : null;

      const data: Form16Extraction = {
        employer_name: null,
        employee_name: null,
        employee_pan: pan,
        employer_tan: null,
        employer_pan: null,
        financial_year: null,
        assessment_year: null,
        total_tax_deducted: tax,
        total_tax_deposited: null,
        gross_total_income: gross,
        total_salary: gross,
        exempt_allowances: null,
        standard_deduction: null,
        professional_tax: null,
        net_taxable_salary: null,
        total_income_tax_payable: tax,
        extraction_notes: 'Extracted using regex fast-path',
        schema_version: 'form16-v1',
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

function isBinaryContent(text: string): boolean {
  if (text.includes('\u0000')) return true;
  const sampleLength = Math.min(text.length, 4096);
  let controlChars = 0;
  for (let i = 0; i < sampleLength; i++) {
    const code = text.charCodeAt(i);
    if (code === 0xfffd || code < 9 || (code > 13 && code < 32)) controlChars++;
  }
  return controlChars / sampleLength > 0.05;
}
