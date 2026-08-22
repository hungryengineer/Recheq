/**
 * RCQ-20122 — Precision, recall and categorised failure modes.
 *
 * Runs the deterministic rules engine over the labelled reliability corpus
 * (fixtures/reliability/) and reports, with honest sample sizes:
 *
 *   - PRECISION — of the findings actually raised (status 'open'), how many
 *     were true tampering. Reported FIRST: a false positive damages a real
 *     person's job prospects.
 *   - RECALL — of doctored cases, how many were caught by an expected rule.
 *   - Every failure categorised into one of five modes:
 *       extraction-error | rule-tolerance-too-tight | rule-tolerance-too-loose |
 *       missing-evidence | genuine-ambiguity
 *
 * Ground truth lives in fixtures/reliability/manifest.json. Payload files may
 * carry underscore-prefixed side-data ("_epfo", "_forensics") which is stripped
 * before schema validation.
 *
 * Usage:
 *   pnpm measure:reliability
 *   pnpm measure:reliability -- --json
 *   pnpm measure:reliability -- --min-precision 0.95 --min-recall 1
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAllChecks, calculateRiskScore, calculateVerdict } from '../packages/rules/src/index.js';
import type {
  CheckContext,
  EpfoHistory,
  ForensicsData,
} from '../packages/rules/src/check-context.js';
import type { EvidenceOrigin } from '../packages/schema/src/evidence.js';
import {
  PayslipExtraction,
  Form16Extraction,
  type FindingInput,
  type PayslipExtraction as PayslipPayload,
  type Form16Extraction as Form16Payload,
} from '../packages/schema/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELIABILITY_DIR = path.resolve(__dirname, '..', 'fixtures', 'reliability');

// ─── Failure-mode taxonomy (per RCQ-20122 AC3) ───────────────────

type FailureMode =
  | 'extraction-error'
  | 'rule-tolerance-too-tight'
  | 'rule-tolerance-too-loose'
  | 'missing-evidence'
  | 'genuine-ambiguity';

interface CategorisedFailure {
  mode: FailureMode;
  caseId: string;
  detail: string;
}

interface CaseResult {
  id: string;
  label: 'clean' | 'doctored';
  tamperMethod: string | null;
  expectedRules: string[];
  findings: FindingInput[];
  openFindings: FindingInput[];
  verdict: ReturnType<typeof calculateVerdict>;
  score: number;
}

interface CorpusCase {
  id: string;
  label: 'clean' | 'doctored';
  payslip: string | null;
  form16: string | null;
  include_epfo: boolean;
  include_forensics: boolean;
  expected_rules: string[];
  tamper_method: string | null;
}

interface Manifest {
  cases: CorpusCase[];
}

class ExtractionError extends Error {
  constructor(
    public readonly caseId: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

// ─── Loading ─────────────────────────────────────────────────────

function stripPrivateKeys(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([k]) => !k.startsWith('_')));
}

function privateData(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = payload[key];
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readJson(fileName: string): Record<string, unknown> {
  const raw: unknown = JSON.parse(fs.readFileSync(path.join(RELIABILITY_DIR, fileName), 'utf8'));
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`${fileName}: not a JSON object`);
  }
  return raw as Record<string, unknown>;
}

function loadManifest(): Manifest {
  const manifest = readJson('manifest.json');
  const cases = manifest['cases'];
  if (!Array.isArray(cases)) throw new Error('manifest.json: missing "cases" array');
  return { cases: cases as CorpusCase[] };
}

function loadPayslip(name: string, caseId: string): PayslipPayload {
  const parsed = PayslipExtraction.safeParse(stripPrivateKeys(readJson(`${name}.json`)));
  if (!parsed.success) {
    throw new ExtractionError(
      caseId,
      `payslip "${name}" failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function loadForm16(name: string, caseId: string): Form16Payload {
  const parsed = Form16Extraction.safeParse(stripPrivateKeys(readJson(`${name}.json`)));
  if (!parsed.success) {
    throw new ExtractionError(
      caseId,
      `form16 "${name}" failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function loadEpfo(payslipName: string, caseId: string): EpfoHistory {
  const data = privateData(readJson(`${payslipName}.json`), '_epfo');
  if (!data) {
    throw new ExtractionError(caseId, `payslip "${payslipName}" has no _epfo side-data`);
  }
  return data as unknown as EpfoHistory;
}

function loadForensics(payslipName: string, caseId: string): ForensicsData[] {
  const data = privateData(readJson(`${payslipName}.json`), '_forensics');
  if (!data) {
    throw new ExtractionError(caseId, `payslip "${payslipName}" has no _forensics side-data`);
  }
  const record = data as unknown as Omit<ForensicsData, 'creation_date' | 'modification_date'> & {
    creation_date: string | null;
    modification_date: string | null;
  };
  return [
    {
      ...record,
      creation_date: record.creation_date ? new Date(record.creation_date) : null,
      modification_date: record.modification_date ? new Date(record.modification_date) : null,
    },
  ];
}

// ─── Evaluation ──────────────────────────────────────────────────

function buildContext(
  c: CorpusCase,
  payslip: PayslipPayload | null,
  form16: Form16Payload | null,
  epfo: EpfoHistory | null,
  forensics: ForensicsData[] | null,
): CheckContext {
  const origins: EvidenceOrigin[] = [];
  if (payslip) origins.push('payslip');
  if (form16) origins.push('form_16');
  if (epfo) origins.push('epfo');
  if (forensics) origins.push('forensics');

  return {
    assembly: {
      // Synthetic case id — this is an offline measurement, not a real case.
      case_id: '00000000-0000-4000-8000-00000000c0de',
      origins,
      has_payslip: payslip !== null,
      has_form16: form16 !== null,
      has_epfo: epfo !== null,
      has_employer: false,
      has_forensics: forensics !== null,
    },
    payslip,
    form16,
    epfoHistory: epfo,
    forensics,
  };
}

function measure(): void {
  const jsonOut = process.argv.includes('--json');
  const minPrecision = readThreshold('--min-precision');
  const minRecall = readThreshold('--min-recall');

  const manifest = loadManifest();
  const results: CaseResult[] = [];
  const failures: CategorisedFailure[] = [];

  for (const c of manifest.cases) {
    let payslip: PayslipPayload | null = null;
    let form16: Form16Payload | null = null;
    let epfo: EpfoHistory | null = null;
    let forensics: ForensicsData[] | null = null;

    try {
      if (c.payslip) payslip = loadPayslip(c.payslip, c.id);
      if (c.form16) form16 = loadForm16(c.form16, c.id);
      if (c.include_epfo && c.payslip) epfo = loadEpfo(c.payslip, c.id);
      if (c.include_forensics && c.payslip) forensics = loadForensics(c.payslip, c.id);
    } catch (err) {
      failures.push({
        mode: 'extraction-error',
        caseId: c.id,
        detail: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const ctx = buildContext(c, payslip, form16, epfo, forensics);
    const findings = runAllChecks(ctx);
    const openFindings = findings.filter((f) => f.status === 'open');
    results.push({
      id: c.id,
      label: c.label,
      tamperMethod: c.tamper_method,
      expectedRules: c.expected_rules,
      findings,
      openFindings,
      score: calculateRiskScore(openFindings),
      verdict: calculateVerdict(openFindings, ctx.assembly.origins.length),
    });
  }

  // ── Metrics ──
  // Finding-level precision over status='open' findings only; 'not_assessed'
  // entries are coverage gaps, not accusations, so they never inflate or
  // deflate precision.
  const doctored = results.filter((r) => r.label === 'doctored');
  const clean = results.filter((r) => r.label === 'clean');

  const truePositives = doctored.flatMap((r) => r.openFindings).length;
  const falsePositives = clean.flatMap((r) => r.openFindings).length;
  const precisionDenominator = truePositives + falsePositives;
  const precision = precisionDenominator === 0 ? 1 : truePositives / precisionDenominator;

  const caught = doctored.filter((r) =>
    r.expectedRules.some((expected) => r.openFindings.some((f) => f.rule_id === expected)),
  );
  const recall = doctored.length === 0 ? 1 : caught.length / doctored.length;

  // ── Categorisation of every failure ──
  for (const r of clean) {
    for (const f of r.openFindings) {
      failures.push({
        mode: 'rule-tolerance-too-tight',
        caseId: r.id,
        detail: `${f.rule_id} (${f.severity}): ${f.explanation}`,
      });
    }
  }
  for (const r of doctored) {
    const firedExpected = r.expectedRules.some((e) => r.openFindings.some((f) => f.rule_id === e));
    const unexpectedOpen = r.openFindings.filter((f) => !r.expectedRules.includes(f.rule_id));
    if (!firedExpected) {
      const blockedByMissingEvidence = r.expectedRules.some((e) =>
        r.findings.some((f) => f.rule_id === e && f.status === 'not_assessed'),
      );
      failures.push({
        mode: blockedByMissingEvidence ? 'missing-evidence' : 'rule-tolerance-too-loose',
        caseId: r.id,
        detail: blockedByMissingEvidence
          ? `expected ${r.expectedRules.join(', ')} could not run (evidence absent); tamper=${r.tamperMethod}`
          : `no expected rule fired for tamper=${r.tamperMethod}; expected ${r.expectedRules.join(', ')}`,
      });
    }
    for (const f of unexpectedOpen) {
      failures.push({
        mode: 'genuine-ambiguity',
        caseId: r.id,
        detail: `${f.rule_id} fired on a doctored case whose declared method is ${r.tamperMethod}: ${f.explanation}`,
      });
    }
  }

  const perMethod = new Map<string, { total: number; caught: number }>();
  for (const r of doctored) {
    const key = r.tamperMethod ?? 'unlabelled';
    const entry = perMethod.get(key) ?? { total: 0, caught: 0 };
    entry.total += 1;
    if (r.expectedRules.some((e) => r.openFindings.some((f) => f.rule_id === e))) {
      entry.caught += 1;
    }
    perMethod.set(key, entry);
  }

  const coverageGaps = new Map<string, number>();
  for (const r of results) {
    for (const f of r.findings) {
      if (f.status === 'not_assessed') {
        coverageGaps.set(f.rule_id, (coverageGaps.get(f.rule_id) ?? 0) + 1);
      }
    }
  }

  const report = { precision, recall, truePositives, falsePositives, results, failures };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport({
      cleanCount: clean.length,
      doctoredCount: doctored.length,
      totalCases: results.length + failures.filter((f) => f.mode === 'extraction-error').length,
      truePositives,
      falsePositives,
      precision,
      recall,
      caughtCount: caught.length,
      perMethod,
      failures,
      coverageGaps,
    });
  }

  if (minPrecision !== null && precision < minPrecision) {
    console.error(`\n✗ precision ${(precision * 100).toFixed(1)}% below floor ${minPrecision}`);
    process.exitCode = 1;
  }
  if (minRecall !== null && recall < minRecall) {
    console.error(`\n✗ recall ${(recall * 100).toFixed(1)}% below floor ${minRecall}`);
    process.exitCode = 1;
  }
  if (failures.some((f) => f.mode === 'extraction-error')) {
    console.error('\n✗ corpus contains extraction errors — fix fixtures before measuring');
    process.exitCode = 1;
  }
}

function readThreshold(flag: string): number | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const raw = process.argv[idx + 1];
  const value = raw === undefined ? NaN : Number(raw);
  if (Number.isNaN(value)) throw new Error(`${flag} requires a number between 0 and 1`);
  return value;
}

// ─── Reporting ───────────────────────────────────────────────────

function printReport(m: {
  cleanCount: number;
  doctoredCount: number;
  totalCases: number;
  truePositives: number;
  falsePositives: number;
  precision: number;
  recall: number;
  caughtCount: number;
  perMethod: Map<string, { total: number; caught: number }>;
  failures: CategorisedFailure[];
  coverageGaps: Map<string, number>;
}): void {
  console.log('════════════════════════════════════════════════════════════');
  console.log(' RCQ-20122 — Reliability of the rules engine (labelled corpus)');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Corpus: n=${m.totalCases} (${m.cleanCount} clean / ${m.doctoredCount} doctored)\n`);

  console.log('PRECISION (reported first — a false positive damages a real');
  console.log(
    `person's job prospects): ${m.truePositives}/${m.truePositives + m.falsePositives} findings were true tampering`,
  );
  console.log(
    `  = ${(m.precision * 100).toFixed(1)}%, i.e. ${m.falsePositives} false positive(s) across ${m.cleanCount} clean documents\n`,
  );

  console.log(`RECALL: ${m.caughtCount}/${m.doctoredCount} doctored documents caught`);
  console.log(`  = ${(m.recall * 100).toFixed(1)}%\n`);

  console.log('Per tamper method:');
  for (const [method, s] of m.perMethod) {
    console.log(`  ${method.padEnd(24)} ${s.caught}/${s.total} caught`);
  }

  console.log('\nCategorised failures:');
  const modes: FailureMode[] = [
    'extraction-error',
    'rule-tolerance-too-tight',
    'rule-tolerance-too-loose',
    'missing-evidence',
    'genuine-ambiguity',
  ];
  let anyFailure = false;
  for (const mode of modes) {
    const entries = m.failures.filter((f) => f.mode === mode);
    if (entries.length === 0) continue;
    anyFailure = true;
    console.log(`  ${mode} (${entries.length})`);
    for (const e of entries) {
      console.log(`    - ${e.caseId}: ${e.detail}`);
    }
  }
  if (!anyFailure) console.log('  none');

  console.log('\nCoverage gaps (rules that emitted not_assessed):');
  if (m.coverageGaps.size === 0) {
    console.log('  none');
  } else {
    for (const [ruleId, count] of [...m.coverageGaps.entries()].sort()) {
      console.log(`  ${ruleId.padEnd(32)} x${count} (no evidence available in those cases)`);
    }
  }
  console.log('\nKnown limits are documented in docs/reliability.md.');
  console.log(
    'Sample sizes are stated on every number above — percentages without n are not evidence.',
  );
}

measure();
