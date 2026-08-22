/**
 * RCQ-20122 — Precision, recall and categorised failure modes.
 *
 * Runs the deterministic rules engine over the labelled reliability corpus
 * (fixtures/reliability/) and reports, with honest sample sizes:
 *
 *   - PRECISION — of the findings actually raised against a document
 *     (status 'open'), how many match the labelled ground truth. Reported
 *     FIRST: a false positive damages a real person's job prospects.
 *     Findings that fire on doctored documents but are not covered by a
 *     label are reported separately and excluded from the ratio until the
 *     corpus labels them.
 *   - RECALL — of ALL manifest-doctored cases (including ones whose
 *     fixtures fail to load), how many were caught by an expected rule.
 *   - Every failure categorised into one of five modes:
 *       extraction-error | rule-tolerance-too-tight | rule-tolerance-too-loose |
 *       missing-evidence | genuine-ambiguity
 *
 * Ground truth lives in fixtures/reliability/manifest.json. The manifest and
 * all side-data ("_epfo", "_forensics") are runtime-validated — malformed
 * input produces a categorised failure, never a crash mid-measurement.
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

// ─── Runtime validation helpers (no casts — malformed input fails loudly) ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${what} must be an object`);
  }
  return value;
}

function assertString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`${what} must be a string`);
  return value;
}

function assertNullableString(value: unknown, what: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`${what} must be a string or null`);
  return value;
}

function assertNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${what} must be a finite number`);
  }
  return value;
}

function validateCorpusCase(raw: unknown, index: number): CorpusCase {
  const c = assertRecord(raw, `manifest.cases[${index}]`);
  const at = (field: string): string => `manifest.cases[${index}].${field}`;

  const id = assertString(c['id'], at('id'));
  const label = assertString(c['label'], at('label'));
  if (label !== 'clean' && label !== 'doctored') {
    throw new Error(`${at('label')} must be "clean" or "doctored"`);
  }
  const payslip = assertNullableString(c['payslip'], at('payslip'));
  const form16 = assertNullableString(c['form16'], at('form16'));
  if (!payslip && !form16) {
    throw new Error(`${at('payslip')}/${at('form16')}: at least one document required`);
  }
  const includeEpfo = c['include_epfo'];
  const includeForensics = c['include_forensics'];
  if (typeof includeEpfo !== 'boolean') throw new Error(`${at('include_epfo')} must be a boolean`);
  if (typeof includeForensics !== 'boolean') {
    throw new Error(`${at('include_forensics')} must be a boolean`);
  }
  const rawRules = c['expected_rules'];
  if (!Array.isArray(rawRules)) throw new Error(`${at('expected_rules')} must be an array`);
  const expectedRules = rawRules.map((r, i) => assertString(r, `${at('expected_rules')}[${i}]`));
  const tamperMethod =
    label === 'doctored'
      ? assertString(c['tamper_method'], at('tamper_method'))
      : assertNullableString(c['tamper_method'], at('tamper_method'));

  return {
    id,
    label,
    payslip,
    form16,
    include_epfo: includeEpfo,
    include_forensics: includeForensics,
    expected_rules: expectedRules,
    tamper_method: tamperMethod,
  };
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
  return assertRecord(raw, fileName);
}

function loadManifest(): Manifest {
  const manifest = readJson('manifest.json');
  const rawCases = manifest['cases'];
  if (!Array.isArray(rawCases)) throw new Error('manifest.json: missing "cases" array');
  const problems: string[] = [];
  const cases: CorpusCase[] = [];
  for (let i = 0; i < rawCases.length; i++) {
    try {
      cases.push(validateCorpusCase(rawCases[i], i));
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `manifest.json contains ${problems.length} invalid case(s):\n  ${problems.join('\n  ')}`,
    );
  }
  return { cases };
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

function validateEpfo(raw: Record<string, unknown>, caseId: string): EpfoHistory {
  const fail = (msg: string): never => {
    throw new ExtractionError(caseId, `_epfo side-data is malformed: ${msg}`);
  };
  const uan = typeof raw['uan'] === 'string' ? raw['uan'] : fail('uan must be a string');
  const rawPeriods = Array.isArray(raw['periods'])
    ? raw['periods']
    : fail('periods must be an array');
  const periods = rawPeriods.map((p, i) => {
    const period = assertRecord(p, `periods[${i}]`);
    const rawContributions = Array.isArray(period['contributions'])
      ? period['contributions']
      : fail(`periods[${i}].contributions must be an array`);
    return {
      employerName: assertString(period['employerName'], `periods[${i}].employerName`),
      establishmentId: assertString(period['establishmentId'], `periods[${i}].establishmentId`),
      startDate: assertString(period['startDate'], `periods[${i}].startDate`),
      endDate: assertNullableString(period['endDate'], `periods[${i}].endDate`),
      contributions: rawContributions.map((cRaw, j) => {
        const contribution = assertRecord(cRaw, `periods[${i}].contributions[${j}]`);
        return {
          month: assertString(contribution['month'], `contributions[${j}].month`),
          employee_share: assertNumber(
            contribution['employee_share'],
            `contributions[${j}].employee_share`,
          ),
          employer_share: assertNumber(
            contribution['employer_share'],
            `contributions[${j}].employer_share`,
          ),
        };
      }),
    };
  });
  return { uan, periods };
}

function validateForensics(raw: Record<string, unknown>, caseId: string): ForensicsData {
  const fontRunsRaw = raw['font_runs'];
  let fontRuns: ForensicsData['font_runs'] = null;
  if (fontRunsRaw !== null) {
    const fr = fontRunsRaw === undefined ? null : assertRecord(fontRunsRaw, 'font_runs');
    fontRuns = fr && {
      total_characters: assertNumber(fr['total_characters'], 'font_runs.total_characters'),
      unique_fonts: assertNumber(fr['unique_fonts'], 'font_runs.unique_fonts'),
      dominant_font: assertString(fr['dominant_font'], 'font_runs.dominant_font'),
      anomalous_characters: assertNumber(
        fr['anomalous_characters'],
        'font_runs.anomalous_characters',
      ),
    };
  }
  const monetaryRaw = raw['monetary_anomalies'];
  let monetaryAnomalies: ForensicsData['monetary_anomalies'] = null;
  if (monetaryRaw !== null) {
    const ma = monetaryRaw === undefined ? null : assertRecord(monetaryRaw, 'monetary_anomalies');
    monetaryAnomalies = ma && {
      flagged_regions: assertNumber(ma['flagged_regions'], 'monetary_anomalies.flagged_regions'),
      highest_confidence_anomaly: assertNumber(
        ma['highest_confidence_anomaly'],
        'monetary_anomalies.highest_confidence_anomaly',
      ),
    };
  }
  const toDate = (v: unknown, what: string): Date | null => {
    const s = assertNullableString(v, what);
    if (s === null) return null;
    // Reject non-ISO strings and impossible calendar dates ("2024-02-31"
    // would silently normalize to March 2nd without the round-trip check).
    const iso =
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
        s,
      );
    if (!iso) {
      throw new ExtractionError(
        caseId,
        `_forensics side-data is malformed: ${what} must be an ISO 8601 date string`,
      );
    }
    const d = new Date(s);
    if (
      Number.isNaN(d.getTime()) ||
      d.getUTCFullYear() !== Number(iso[1]) ||
      d.getUTCMonth() + 1 !== Number(iso[2]) ||
      d.getUTCDate() !== Number(iso[3])
    ) {
      throw new ExtractionError(
        caseId,
        `_forensics side-data is malformed: ${what} (${s}) is not a real calendar date`,
      );
    }
    return d;
  };
  return {
    producer: assertNullableString(raw['producer'], 'producer'),
    creator: assertNullableString(raw['creator'], 'creator'),
    creation_date: toDate(raw['creation_date'], 'creation_date'),
    modification_date: toDate(raw['modification_date'], 'modification_date'),
    font_runs: fontRuns,
    monetary_anomalies: monetaryAnomalies,
  };
}

function loadEpfo(payslipName: string, caseId: string): EpfoHistory {
  const data = privateData(readJson(`${payslipName}.json`), '_epfo');
  if (!data) {
    throw new ExtractionError(caseId, `payslip "${payslipName}" has no _epfo side-data`);
  }
  return validateEpfo(data, caseId);
}

function loadForensics(payslipName: string, caseId: string): ForensicsData[] {
  const data = privateData(readJson(`${payslipName}.json`), '_forensics');
  if (!data) {
    throw new ExtractionError(caseId, `payslip "${payslipName}" has no _forensics side-data`);
  }
  return [validateForensics(data, caseId)];
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

function readThreshold(flag: string): number | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const raw = process.argv[idx + 1];
  const value = raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${flag} requires a number between 0 and 1`);
  }
  return value;
}

function measure(): void {
  const jsonOut = process.argv.includes('--json');
  const minPrecision = readThreshold('--min-precision');
  const minRecall = readThreshold('--min-recall');

  const manifest = loadManifest();
  const manifestDoctoredTotal = manifest.cases.filter((c) => c.label === 'doctored').length;

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
  // Only status='open' findings count as accusations ('not_assessed' entries
  // are coverage gaps). A finding is a TRUE positive only when it matches the
  // labelled ground-truth rule for that doctored case; unlabelled fires on
  // doctored documents are reported separately and stay out of both sides of
  // the ratio until the corpus labels them.
  const doctored = results.filter((r) => r.label === 'doctored');
  const clean = results.filter((r) => r.label === 'clean');

  const isExpected = (r: CaseResult, f: FindingInput): boolean =>
    r.expectedRules.includes(f.rule_id);

  const truePositives = doctored.flatMap((r) =>
    r.openFindings.filter((f) => isExpected(r, f)),
  ).length;
  const falsePositives = clean.flatMap((r) => r.openFindings).length;
  const unlabelledFindings = doctored.flatMap((r) =>
    r.openFindings.filter((f) => !isExpected(r, f)),
  ).length;
  const precisionDenominator = truePositives + falsePositives;
  const precision = precisionDenominator === 0 ? 1 : truePositives / precisionDenominator;

  const caught = doctored.filter((r) =>
    r.expectedRules.some((expected) => r.openFindings.some((f) => f.rule_id === expected)),
  );
  // Recall's denominator covers EVERY manifest-doctored case: a case whose
  // fixture fails to load was not caught either.
  const recall = manifestDoctoredTotal === 0 ? 1 : caught.length / manifestDoctoredTotal;

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
    const unexpectedOpen = r.openFindings.filter((f) => !isExpected(r, f));
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
  for (const c of manifest.cases) {
    if (c.label !== 'doctored') continue;
    const key = c.tamper_method ?? 'unlabelled';
    const entry = perMethod.get(key) ?? { total: 0, caught: 0 };
    entry.total += 1;
    const result = caught.find((r) => r.id === c.id);
    if (result) entry.caught += 1;
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

  const report = {
    corpus: {
      total_manifest_cases: manifest.cases.length,
      clean: clean.length,
      doctored: manifestDoctoredTotal,
      loaded: results.length,
      failed_to_load: manifest.cases.length - results.length,
    },
    precision,
    recall,
    truePositives,
    falsePositives,
    unlabelledFindings,
    caught: caught.length,
    perMethod: Object.fromEntries(perMethod),
    coverageGaps: Object.fromEntries(coverageGaps),
    failures,
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport({
      cleanCount: clean.length,
      doctoredTotal: manifestDoctoredTotal,
      totalCases: manifest.cases.length,
      truePositives,
      falsePositives,
      unlabelledFindings,
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

// ─── Reporting ───────────────────────────────────────────────────

function printReport(m: {
  cleanCount: number;
  doctoredTotal: number;
  totalCases: number;
  truePositives: number;
  falsePositives: number;
  unlabelledFindings: number;
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
  console.log(`Corpus: n=${m.totalCases} (${m.cleanCount} clean / ${m.doctoredTotal} doctored)\n`);

  console.log('PRECISION (reported first — a false positive damages a real');
  console.log(
    `person's job prospects): ${m.truePositives}/${m.truePositives + m.falsePositives} raised findings matched the labelled ground truth`,
  );
  console.log(
    `  = ${(m.precision * 100).toFixed(1)}%, i.e. ${m.falsePositives} false positive(s) across ${m.cleanCount} clean documents`,
  );
  if (m.unlabelledFindings > 0) {
    console.log(
      `  ${m.unlabelledFindings} finding(s) on doctored documents fired rules outside their labels;`,
    );
    console.log(
      '  they are listed under genuine-ambiguity and excluded from the ratio until labelled.',
    );
  }
  console.log('');

  console.log(`RECALL: ${m.caughtCount}/${m.doctoredTotal} doctored documents caught`);
  console.log(`  (every manifest doctored case counts in the denominator —`);
  console.log(`   one whose fixture fails to load counts as NOT caught)\n`);

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
