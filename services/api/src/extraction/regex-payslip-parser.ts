import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface ExtractedPayslipFields {
  orgName: string;
  pan: string;
  tds: string;
  salary: string;
}

/**
 * Extracts specific structured fields from a PDF payslip using pdf-parse and regex.
 * This provides a fast, offline alternative to LLM extraction for standard templates.
 */
export async function parsePayslipPdf(pdfBuffer: Buffer): Promise<ExtractedPayslipFields> {
  // Parse PDF to raw text
  const data = await pdfParse(pdfBuffer);
  const text = data.text;
  
  // Extract PAN: PAN followed by optional chars and then the PAN format
  const panMatch = text.match(/PAN\s*([A-Z]{5}\d{4}[A-Z])/i) || text.match(/([A-Z]{5}\d{4}[A-Z])/);
  const pan = panMatch ? panMatch[1] : 'Not Found';

  // Extract TDS: TDS followed by anything not a digit, then the amount
  const tdsMatch = text.match(/TDS[^\d]*([\d,]+\.\d{2})/i);
  const tds = tdsMatch ? tdsMatch[1] : 'Not Found';

  // Extract Salary (Net Pay or Gross)
  const netPayMatch = text.match(/NET (?:PAY|SALARY|CREDITED)[^\d]*([\d,]+\.\d{2})/i);
  const salary = netPayMatch ? netPayMatch[1] : 'Not Found';

  // Extract Org Name
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const pvtLtdMatch = lines.find(l => l.toLowerCase().includes('pvt. ltd.'));
  const orgName = pvtLtdMatch ? pvtLtdMatch : lines[0];

  return {
    orgName,
    tds,
    salary,
    pan
  };
}
