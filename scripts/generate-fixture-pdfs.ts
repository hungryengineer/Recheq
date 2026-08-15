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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'fixtures', 'documents');

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

interface PayslipData {
  employeeName: string;
  employeeId: string;
  department: string;
  designation: string;
  employerName: string;
  month: string;
  year: number;
  uan: string;
  pfAccount: string;
  basic: number;
  hra: number;
  da: number;
  specialAllowance: number;
  transportAllowance: number;
  grossSalary: number;
  pfDeduction: number;
  professionalTax: number;
  incomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
}

async function generatePayslipPdf(data: PayslipData): Promise<Uint8Array> {
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

  const earnings: [string, number][] = [
    ['Basic Salary', data.basic],
    ['House Rent Allowance', data.hra],
    ['Dearness Allowance', data.da],
    ['Special Allowance', data.specialAllowance],
    ['Transport Allowance', data.transportAllowance],
  ];

  const deductions: [string, number][] = [
    ['Provident Fund (Employee)', data.pfDeduction],
    ['Professional Tax', data.professionalTax],
    ['Income Tax (TDS)', data.incomeTax],
    ...(data.otherDeductions > 0
      ? [['Other Deductions', data.otherDeductions] as [string, number]]
      : []),
  ];

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

interface Form16Data {
  employeeName: string;
  employeePan: string;
  employerName: string;
  employerTan: string;
  employerPan: string;
  financialYear: string;
  assessmentYear: string;
  grossTotalIncome: number;
  totalSalary: number;
  exemptAllowances: number;
  standardDeduction: number;
  professionalTax: number;
  netTaxableIncome: number;
  totalTaxDeducted: number;
  totalTaxDeposited: number;
}

async function generateForm16Pdf(data: Form16Data): Promise<Uint8Array> {
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
    ['Gross Total Income', inr(data.grossTotalIncome)],
    ['Total Tax Deducted at Source', inr(data.totalTaxDeducted)],
    ['Total Tax Deposited', inr(data.totalTaxDeposited)],
  ];

  for (const [label, value] of rows) {
    drawLine(ctx, M, y, W - M, y, 0.3);
    drawText(ctx, label, M + 8, y - 10, { size: 8, color: DARK });
    drawText(ctx, value, W - M - 90, y - 10, { size: 9, font: 'bold' });
    y -= 20;
  }

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
  const partBRows: [string, string, boolean][] = [
    ['Gross Salary (u/s 17(1))', inr(data.totalSalary), false],
    ['Less: Exempt Allowances (u/s 10)', inr(data.exemptAllowances), false],
    ['Net Salary', inr(data.totalSalary - data.exemptAllowances), false],
    ['Less: Standard Deduction (u/s 16(ia))', inr(data.standardDeduction), false],
    ['Less: Professional Tax (u/s 16(iii))', inr(data.professionalTax), false],
    ['Income Chargeable under "Salaries"', inr(data.netTaxableIncome), true],
    ['Total Income Tax Payable', inr(data.totalTaxDeducted), true],
  ];

  for (const [label, value, isBold] of partBRows) {
    const bg = isBold ? rgb(0.88, 0.93, 0.98) : rgb(1, 1, 1);
    drawRect(ctx, M, y - 14, W - 2 * M, 16, bg);
    drawLine(ctx, M, y, W - M, y, 0.3);
    drawText(ctx, label, M + 8, y - 9, { size: 8, font: isBold ? 'bold' : 'regular', color: DARK });
    drawText(ctx, value, W - M - 90, y - 9, { size: 9, font: 'bold' });
    y -= 16;
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

// ─── Fixture data ─────────────────────────────────────────────────

// Demo persona: Arun Kumar, UAN 100123456789, Acme Technologies Pvt Ltd
// clean-01: consistent, basic=30000, pf=3600 (12% of basic ✓)

const cleanPayslip: PayslipData = {
  employeeName: 'Arun Kumar',
  employeeId: 'ACM-2847',
  department: 'Engineering',
  designation: 'Senior Software Engineer',
  employerName: 'Acme Technologies Pvt Ltd',
  month: 'March',
  year: 2026,
  uan: '100123456789',
  pfAccount: 'MH/MUM/12345/000/2847',
  basic: 30000,
  hra: 12000,
  da: 3000,
  specialAllowance: 8000,
  transportAllowance: 1600,
  grossSalary: 54600,
  pfDeduction: 3600, // 12% of 30000 ✓
  professionalTax: 200,
  incomeTax: 4800,
  otherDeductions: 0,
  totalDeductions: 8600,
  netSalary: 46000, // 54600 - 8600 = 46000 ✓
};

const cleanForm16: Form16Data = {
  employeeName: 'Arun Kumar',
  employeePan: 'ABCAK5678G',
  employerName: 'Acme Technologies Pvt Ltd',
  employerTan: 'MUMA12345D',
  employerPan: 'AAACA5678B',
  financialYear: '2025-26',
  assessmentYear: '2026-27',
  grossTotalIncome: 655200, // 54600 × 12
  totalSalary: 655200,
  exemptAllowances: 19200, // HRA partial exemption
  standardDeduction: 50000,
  professionalTax: 2400,
  netTaxableIncome: 583600,
  totalTaxDeducted: 57600, // ~10% effective
  totalTaxDeposited: 57600,
};

// doctored-01: basic inflated 30000→52000, PF left at 3600 (should be 6240)
// fires: pf-implies-basic (3600÷0.12=30000 ≠ 52000), pf-matches-epfo (EPFO says 1800)

const doctoredPayslip01: PayslipData = {
  ...cleanPayslip,
  basic: 52000, // ← TAMPERED (was 30000)
  hra: 20800, // looks proportional
  grossSalary: 85400, // adjusted so it looks internally consistent with new basic
  pfDeduction: 3600, // ← LEFT UNCHANGED — the tell
  totalDeductions: 8600, // unchanged
  netSalary: 76800, // 85400 - 8600 = 76800 ✓ (arithmetic holds; PF is the anomaly)
};

// doctored-02: net salary tampered, gross-deductions≠net
// fires: payslip-arithmetic-net

const doctoredPayslip02: PayslipData = {
  ...cleanPayslip,
  netSalary: 58000, // ← TAMPERED: should be 46000 (54600 - 8600)
};

// ─── Main ─────────────────────────────────────────────────────────

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writePdf(filePath: string, bytes: Uint8Array) {
  await fs.writeFile(filePath, bytes);
  const kb = (bytes.length / 1024).toFixed(1);
  console.log(`  ✓ ${path.relative(ROOT, filePath)} (${kb} KB)`);
}

async function main() {
  console.log('Generating fixture PDFs...\n');

  await ensureDir(path.join(DOCS, 'clean-01'));
  await ensureDir(path.join(DOCS, 'doctored-01'));
  await ensureDir(path.join(DOCS, 'doctored-02'));

  // clean-01
  await writePdf(
    path.join(DOCS, 'clean-01', 'payslip.pdf'),
    await generatePayslipPdf(cleanPayslip),
  );
  await writePdf(path.join(DOCS, 'clean-01', 'form16.pdf'), await generateForm16Pdf(cleanForm16));

  // doctored-01: basic inflated, PF unchanged
  await writePdf(
    path.join(DOCS, 'doctored-01', 'payslip.pdf'),
    await generatePayslipPdf(doctoredPayslip01),
  );
  await writePdf(
    path.join(DOCS, 'doctored-01', 'form16.pdf'),
    await generateForm16Pdf(cleanForm16), // Form 16 matches clean — cross-doc inconsistency
  );

  // doctored-02: net pay tampered
  await writePdf(
    path.join(DOCS, 'doctored-02', 'payslip.pdf'),
    await generatePayslipPdf(doctoredPayslip02),
  );

  console.log('\nDone. Files written to fixtures/documents/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
