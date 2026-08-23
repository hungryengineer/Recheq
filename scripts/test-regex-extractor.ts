import fs from 'node:fs';
import path from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { RegexDocumentExtractor } from '../services/api/src/extraction/providers/regex-extractor.js';

async function runTest() {
  const extractor = new RegexDocumentExtractor();
  
  // Choose one of the sample templates to test
  const pdfPath = path.join(process.cwd(), 'docs/diverse_salary_slip_templates/salary_slip_template_5.pdf');
  
  console.log(`Loading PDF from: ${pdfPath}`);
  const pdfBuffer = fs.readFileSync(pdfPath);
  
  // 1. Upstream PDF parsing (as required by the extractor contract)
  const parsedData = await pdfParse(pdfBuffer);
  const documentContent = parsedData.text;
  
  // 2. Invoke our unified extractor
  console.log('Invoking RegexDocumentExtractor...\n');
  const result = await extractor.extractPayslip({
    documentId: 'test-doc-123',
    documentKind: 'payslip',
    documentContent,
    mimeType: 'application/pdf',
    schemaVersion: 'payslip-v1'
  });
  
  if (result.status === 'success') {
    console.log('Extraction Successful!');
    console.log('--- Extracted Data ---');
    console.log(JSON.stringify({
      employer_name: result.data.employer_name,
      pan: result.data.pan,
      income_tax: result.data.income_tax,
      net_salary: result.data.net_salary,
    }, null, 2));
  } else {
    console.error('Extraction Failed:', result.error);
  }
}

runTest().catch(console.error);
