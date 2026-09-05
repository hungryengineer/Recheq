/**
 * OPS-1: Generate demo fixture PDFs.
 * Produces realistic-looking payslip and Form 16 documents for clean and doctored scenarios.
 *
 * Usage: npx tsx scripts/generate-fixture-pdfs.ts
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePdfPath } from './lib/extraction-corpus.js';
import {
  fixtureJsonPath,
  listFixtureJsonFiles,
  loadForm16RenderData,
  loadPayslipRenderData,
  type Form16RenderData,
  type PayslipRenderData,
} from './lib/fixture-pdf-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'fixtures', 'extraction');
const DOCS = path.join(ROOT, 'fixtures', 'documents');
const TEMPLATES = path.join(ROOT, 'docs', 'diverse_salary_slip_templates');

const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.92, 0.92, 0.92);
const ACCENT = rgb(0.13, 0.33, 0.6); // corporate blue

// ─── PDF helpers ──────────────────────────────────────────────────

async function newDoc() {
  const doc = await PDFDocument.create();
  doc.setTitle('Payslip');
  doc.setProducer('HR Suite v3.2');
  doc.setCreator('HR Suite v3.2');
  const page = doc.addPage([595, 842]); // A4
  return { doc, page };
}

type DrawCtx = {
  page: ReturnType<ReturnType<PDFDocument['addPage']>['drawText']> extends void
    ? Awaited<ReturnType<typeof newDoc>>['page']
    : Awaited<ReturnType<typeof newDoc>>['page'];
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>;
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>;
};

function drawText(
  ctx: DrawCtx,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; font?: 'bold' | 'regular'; color?: ReturnType<typeof rgb> } = {},
) {
  const { size = 9, font = 'regular', color = BLACK } = opts;
  ctx.page.drawText(text, {
    x,
    y,
    size,
    font: font === 'bold' ? ctx.bold : ctx.regular,
    color,
  });
}

function drawLine(ctx: DrawCtx, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) {
  ctx.page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: GREY,
  });
}

function drawRect(
  ctx: DrawCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: ReturnType<typeof rgb>,
) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color });
}

function inr(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN')}`;
}

// ─── Payslip generator ────────────────────────────────────────────

async function generatePayslipPdf(data: PayslipRenderData): Promise<Uint8Array> {
  const { doc, page } = await newDoc();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const ctx: DrawCtx = { page, bold, regular };

  const W = 595;
  const M = 40; // margin

  // Header bar
  drawRect(ctx, 0, 800, W, 42, ACCENT);
  drawText(ctx, data.employerName.toUpperCase(), M, 818, {
    size: 12,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawText(ctx, `Payslip — ${data.month} ${data.year}`, W - 190, 818, {
    size: 10,
    font: 'bold',
    color: rgb(0.85, 0.85, 0.85),
  });

  // Employee info block
  let y = 780;
  drawRect(ctx, M, y - 58, W - 2 * M, 62, LIGHT);
  drawText(ctx, 'Employee Details', M + 8, y - 8, { size: 8, font: 'bold', color: GREY });

  const col1x = M + 8;
  const col2x = 200;
  const col3x = 370;

  y -= 22;
  drawText(ctx, 'Name:', col1x, y, { size: 8, color: GREY });
  drawText(ctx, data.employeeName, col1x + 45, y, { size: 9, font: 'bold' });
  drawText(ctx, 'Employee ID:', col2x, y, { size: 8, color: GREY });
  drawText(ctx, data.employeeId, col2x + 70, y, { size: 9 });
  drawText(ctx, 'UAN:', col3x, y, { size: 8, color: GREY });
  drawText(ctx, data.uan, col3x + 30, y, { size: 9 });

  y -= 16;
  drawText(ctx, 'Department:', col1x, y, { size: 8, color: GREY });
  drawText(ctx, data.department, col1x + 65, y, { size: 9 });
  drawText(ctx, 'Designation:', col2x, y, { size: 8, color: GREY });
  drawText(ctx, data.designation, col2x + 72, y, { size: 9 });
  drawText(ctx, 'PF Account:', col3x, y, { size: 8, color: GREY });
  drawText(ctx, data.pfAccount, col3x + 62, y, { size: 8 });

  // Earnings / Deductions table
  y -= 32;
  const _tableTop = y;
  const LX = M; // left col start
  const RX = 310; // right col start
  const COL_W = (W - 2 * M) / 2 - 8;

  // Table header
  drawRect(ctx, LX, y, COL_W, 18, ACCENT);
  drawRect(ctx, RX, y, COL_W, 18, ACCENT);
  drawText(ctx, 'EARNINGS', LX + 8, y + 5, { size: 8, font: 'bold', color: rgb(1, 1, 1) });
  drawText(ctx, 'Amount (Rs.)', LX + COL_W - 80, y + 5, {
    size: 8,
    color: rgb(0.85, 0.85, 0.85),
  });
  drawText(ctx, 'DEDUCTIONS', RX + 8, y + 5, { size: 8, font: 'bold', color: rgb(1, 1, 1) });
  drawText(ctx, 'Amount (Rs.)', RX + COL_W - 80, y + 5, {
    size: 8,
    color: rgb(0.85, 0.85, 0.85),
  });

  const earnings = data.earnings;
  const deductions = data.deductions;

  const rows = Math.max(earnings.length, deductions.length);
  y -= 18;

  for (let i = 0; i < rows; i++) {
    const rowColor = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.97, 0.97);
    drawRect(ctx, LX, y - 14, COL_W, 16, rowColor);
    drawRect(ctx, RX, y - 14, COL_W, 16, rowColor);

    const e = earnings[i];
    if (e) {
      drawText(ctx, e[0], LX + 8, y - 8, { size: 8 });
      drawText(ctx, e[1].toLocaleString('en-IN'), LX + COL_W - 55, y - 8, {
        size: 8,
        font: 'bold',
      });
    }
    const d = deductions[i];
    if (d) {
      drawText(ctx, d[0], RX + 8, y - 8, { size: 8 });
      drawText(ctx, d[1].toLocaleString('en-IN'), RX + COL_W - 55, y - 8, {
        size: 8,
        font: 'bold',
      });
    }
    y -= 16;
  }

  // Totals row
  drawRect(ctx, LX, y - 14, COL_W, 18, rgb(0.88, 0.93, 0.98));
  drawRect(ctx, RX, y - 14, COL_W, 18, rgb(0.88, 0.93, 0.98));
  drawText(ctx, 'Gross Salary', LX + 8, y - 8, { size: 9, font: 'bold' });
  drawText(ctx, data.grossSalary.toLocaleString('en-IN'), LX + COL_W - 60, y - 8, {
    size: 9,
    font: 'bold',
  });
  drawText(ctx, 'Total Deductions', RX + 8, y - 8, { size: 9, font: 'bold' });
  drawText(ctx, data.totalDeductions.toLocaleString('en-IN'), RX + COL_W - 60, y - 8, {
    size: 9,
    font: 'bold',
  });

  // Net salary band
  y -= 32;
  drawRect(ctx, LX, y - 20, W - 2 * M, 28, ACCENT);
  drawText(ctx, 'NET SALARY (Take Home)', LX + 8, y - 10, {
    size: 11,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawText(ctx, inr(data.netSalary), W - M - 115, y - 10, {
    size: 13,
    font: 'bold',
    color: rgb(1, 1, 1),
  });

  // Footer
  y -= 50;
  drawLine(ctx, M, y, W - M, y);
  drawText(
    ctx,
    'This is a computer-generated payslip and does not require a signature.',
    M,
    y - 14,
    {
      size: 7,
      color: GREY,
    },
  );
  drawText(ctx, `Payment Mode: Bank Transfer   Bank: HDFC Bank   Account: ****7823`, M, y - 26, {
    size: 7,
    color: GREY,
  });

  return doc.save({ useObjectStreams: false });
}

// ─── Form 16 generator ───────────────────────────────────────────

async function generateForm16Pdf(data: Form16RenderData): Promise<Uint8Array> {
  const { doc, page } = await newDoc();
  doc.setTitle('Form 16');
  doc.setProducer('TaxFiler Pro v2.1');
  doc.setCreator('TaxFiler Pro v2.1');
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const ctx: DrawCtx = { page, bold, regular };

  const W = 595;
  const M = 40;

  // Title block
  drawRect(ctx, 0, 800, W, 42, rgb(0.1, 0.3, 0.1));
  drawText(ctx, 'FORM 16 — Certificate of Tax Deducted at Source', M, 818, {
    size: 11,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawText(ctx, `FY ${data.financialYear} / AY ${data.assessmentYear}`, W - 200, 818, {
    size: 9,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Subtitle
  let y = 785;
  drawText(
    ctx,
    'Under Section 203 of the Income-tax Act, 1961 for tax deducted at source from income chargeable under the head "Salaries"',
    M,
    y,
    { size: 7, color: GREY },
  );

  // Employer / Employee details
  y -= 22;
  drawRect(ctx, M, y - 54, W - 2 * M, 58, LIGHT);

  y -= 12;
  drawText(ctx, 'EMPLOYER (DEDUCTOR)', M + 8, y, { size: 8, font: 'bold', color: GREY });
  drawText(ctx, 'EMPLOYEE (DEDUCTEE)', 320, y, { size: 8, font: 'bold', color: GREY });

  y -= 14;
  drawText(ctx, 'Name:', M + 8, y, { size: 8, color: GREY });
  drawText(ctx, data.employerName, M + 40, y, { size: 9, font: 'bold' });
  drawText(ctx, 'Name:', 320, y, { size: 8, color: GREY });
  drawText(ctx, data.employeeName, 352, y, { size: 9, font: 'bold' });

  y -= 13;
  drawText(ctx, 'TAN:', M + 8, y, { size: 8, color: GREY });
  drawText(ctx, data.employerTan, M + 32, y, { size: 8 });
  drawText(ctx, 'PAN:', 320, y, { size: 8, color: GREY });
  drawText(ctx, data.employeePan, 344, y, { size: 8 });

  y -= 13;
  drawText(ctx, 'PAN:', M + 8, y, { size: 8, color: GREY });
  drawText(ctx, data.employerPan, M + 32, y, { size: 8 });

  // Part A heading
  y -= 30;
  drawRect(ctx, M, y, W - 2 * M, 16, ACCENT);
  drawText(
    ctx,
    'PART A — Details of Tax Deducted and Deposited in Central Government Account',
    M + 8,
    y + 4,
    { size: 8, font: 'bold', color: rgb(1, 1, 1) },
  );

  y -= 22;
  const rows: [string, string][] = [
    ...(data.grossTotalIncome != null
      ? [['Gross Total Income', inr(data.grossTotalIncome)] as [string, string]]
      : []),
    ['Total Tax Deducted at Source', inr(data.totalTaxDeducted)],
    ['Total Tax Deposited', inr(data.totalTaxDeposited)],
  ];

  for (const [label, value] of rows) {
    drawLine(ctx, M, y, W - M, y, 0.3);
    drawText(ctx, label, M + 8, y - 10, { size: 8, color: DARK });
    drawText(ctx, value, W - M - 90, y - 10, { size: 9, font: 'bold' });
    y -= 20;
  }

  if (data.includePartB) {
    // Part B heading
    y -= 14;
    drawRect(ctx, M, y, W - 2 * M, 16, ACCENT);
    drawText(
      ctx,
      'PART B — Details of Salary Paid and any other income and tax deducted',
      M + 8,
      y + 4,
      { size: 8, font: 'bold', color: rgb(1, 1, 1) },
    );

    y -= 22;
    const totalSalary = data.totalSalary ?? 0;
    const exemptAllowances = data.exemptAllowances ?? 0;
    const standardDeduction = data.standardDeduction ?? 0;
    const professionalTax = data.professionalTax ?? 0;
    const netTaxableIncome = data.netTaxableIncome ?? 0;
    const totalIncomeTaxPayable = data.totalIncomeTaxPayable ?? data.totalTaxDeducted;

    const partBRows: [string, string, boolean][] = [
      ['Gross Salary (u/s 17(1))', inr(totalSalary), false],
      ['Less: Exempt Allowances (u/s 10)', inr(exemptAllowances), false],
      ['Net Salary', inr(totalSalary - exemptAllowances), false],
      ['Less: Standard Deduction (u/s 16(ia))', inr(standardDeduction), false],
      ['Less: Professional Tax (u/s 16(iii))', inr(professionalTax), false],
      ['Income Chargeable under "Salaries"', inr(netTaxableIncome), true],
      ['Total Income Tax Payable', inr(totalIncomeTaxPayable), true],
    ];

    for (const [label, value, isBold] of partBRows) {
      const bg = isBold ? rgb(0.88, 0.93, 0.98) : rgb(1, 1, 1);
      drawRect(ctx, M, y - 14, W - 2 * M, 16, bg);
      drawLine(ctx, M, y, W - M, y, 0.3);
      drawText(ctx, label, M + 8, y - 9, {
        size: 8,
        font: isBold ? 'bold' : 'regular',
        color: DARK,
      });
      drawText(ctx, value, W - M - 90, y - 9, { size: 9, font: 'bold' });
      y -= 16;
    }
  } else {
    y -= 10;
    drawText(ctx, 'Part B not attached to this certificate.', M + 8, y - 10, {
      size: 8,
      color: GREY,
    });
  }

  // Footer
  y -= 30;
  drawLine(ctx, M, y, W - M, y);
  drawText(
    ctx,
    'I, the undersigned, certify that the particulars furnished above are correct and complete.',
    M,
    y - 14,
    { size: 7, color: GREY },
  );
  drawText(ctx, 'Authorised Signatory', W - M - 110, y - 30, { size: 8, font: 'bold' });
  drawText(ctx, '(Signature)', W - M - 80, y - 44, { size: 7, color: GREY });

  return doc.save({ useObjectStreams: false });
}

// ─── Main ─────────────────────────────────────────────────────────

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writePdf(filePath: string, bytes: Uint8Array) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, bytes);
  const kb = (bytes.length / 1024).toFixed(1);
  console.log(`  ✓ ${path.relative(ROOT, filePath)} (${kb} KB)`);
}

export async function generateAllFixturePdfs(): Promise<string[]> {
  const written: string[] = [];
  const labels = listFixtureJsonFiles(FIXTURES);

  for (const labelFile of labels) {
    const resolved = resolvePdfPath(labelFile, {
      fixturesDir: FIXTURES,
      documentsDir: DOCS,
      templatesDir: TEMPLATES,
    });

    if (resolved.source === 'template') {
      continue;
    }

    const fixturePath = fixtureJsonPath(FIXTURES, labelFile);
    const bytes =
      resolved.docType === 'payslip'
        ? await generatePayslipPdf(loadPayslipRenderData(fixturePath))
        : await generateForm16Pdf(loadForm16RenderData(fixturePath));

    await writePdf(resolved.pdfPath, bytes);
    written.push(resolved.pdfPath);
  }

  return written;
}

async function main() {
  try {
    console.log('Generating fixture PDFs...\n');
    const written = await generateAllFixturePdfs();
    console.log(`\nDone. ${written.length} files written to fixtures/documents/`);
  } catch (err) {
    console.error('PDF generation failed:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

void main();
