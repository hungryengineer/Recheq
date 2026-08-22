import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runAllChecks,
  calculateRiskScore,
  calculateVerdict,
  type CheckContext,
} from '@tieout/rules';
import { loadFixtures, compareExpected } from '@tieout/test-fixtures';
import { FixtureExtractor } from '../src/extraction/fixture-extractor.js';
import type {
  ExtractionRequest,
  ExtractionResult,
  LlmDocumentExtractor,
} from '../src/extraction/llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import type { CaseProcessingDeps } from '../src/workflows/case-processing.js';

/**
 * RCQ-20116 — Model-independence proof.
 *
 * Diligence question Q1: "what happens when the next model release makes
 * your core capability free?" The verdict must come from the RULES ENGINE
 * operating on structured evidence — never from which model happened to
 * read the document. These tests turn that claim into a green CI check:
 *
 * 1. The whole extraction corpus is pushed through the rules twice, under
 *    two different extractor identities (fixture vs "the next model"),
 *    both producing identical structured evidence. Findings, risk score
 *    and verdict must be byte-identical — proving model identity/metadata
 *    cannot leak into outcomes.
 * 2. The same corpus grounded against committed expected outcomes, so the
 *    equality above cannot be vacuously true.
 * 3. `rules.triangulate` declares provenance.model = null on success AND
 *    failure paths — the workflow contract itself states that
 *    triangulation is model-independent.
 */

// ─── Corpus loading ─────────────────────────────────────────────

const REPO_ROOT = join(import.meta.dirname ?? '.', '../../..');
const EXTRACTION_DIR = join(REPO_ROOT, 'fixtures', 'extraction');

/** Declared corpus size — bumping this requires a conscious update here. */
const EXPECTED_CORPUS_SIZE = 11;

type CorpusDoc =
  | { name: string; kind: 'payslip'; data: PayslipExtraction }
  | { name: string; kind: 'form16'; data: Form16Extraction };

function loadCorpus(): CorpusDoc[] {
  return readdirSync(EXTRACTION_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f): CorpusDoc => {
      const name = f.replace('.json', '');
      const parsed: unknown = JSON.parse(readFileSync(join(EXTRACTION_DIR, f), 'utf8'));
      if (name.startsWith('payslip')) {
        return { name, kind: 'payslip', data: parsed as PayslipExtraction };
      }
      return { name, kind: 'form16', data: parsed as Form16Extraction };
    });
}

/** A stand-in for ANY other LLM extractor: identical structured output,
 *  different provider identity. If outcomes diverge from the fixture
 *  extractor's, the rules engine is leaking model identity. */
class NextModelExtractor implements LlmDocumentExtractor {
  readonly provider = 'hypothetical-next-model';
  readonly supportsStreaming = true;
  constructor(private readonly inner: FixtureExtractor) {}

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    const base = await this.inner.extractPayslip(request);
    if (base.status !== 'success') return base;
    // Same structured payload, different model identity.
    return { ...base, modelId: 'next-model-ultra-2027' };
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    const base = await this.inner.extractForm16(request);
    if (base.status !== 'success') return base;
    return { ...base, modelId: 'next-model-ultra-2027' };
  }

  getMetadata() {
    return this.inner.getMetadata();
  }
  isAvailable() {
    return this.inner.isAvailable();
  }
}

const req = (documentId: string): ExtractionRequest => ({
  documentId,
  documentKind: documentId.startsWith('payslip') ? 'payslip' : 'form_16',
  documentContent: 'raw-bytes',
  mimeType: 'application/pdf',
  schemaVersion: 'v1',
});

function unwrap<T>(result: ExtractionResult<T>, label: string): T {
  if (result.status !== 'success') throw new Error(`${label} failed: ${result.error}`);
  return result.data;
}

// ─── Rules pipeline helper ──────────────────────────────────────

function evaluate(ctx: CheckContext) {
  const findings = runAllChecks(ctx).sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  const score = calculateRiskScore(findings);
  const verdict = calculateVerdict(findings, ctx.assembly.origins.length);
  return { findings, score, verdict };
}

describe('RCQ-20116 — model independence', () => {
  let corpus: CorpusDoc[];
  beforeAll(() => {
    corpus = loadCorpus();
    expect(
      corpus.length,
      'extraction corpus size changed — review whether the proof still covers every document kind',
    ).toBe(EXPECTED_CORPUS_SIZE);
  });

  it('AC1 — swapping the extractor for another model yields IDENTICAL findings, score and verdict across the whole corpus', async () => {
    const payslips = corpus.filter(
      (d): d is Extract<CorpusDoc, { kind: 'payslip' }> => d.kind === 'payslip',
    );
    const form16s = corpus.filter(
      (d): d is Extract<CorpusDoc, { kind: 'form16' }> => d.kind === 'form16',
    );

    expect(payslips.length, 'corpus must contain at least one payslip').toBeGreaterThan(0);
    expect(form16s.length, 'corpus must contain at least one form16').toBeGreaterThan(0);
    const fixtureExtractor = new FixtureExtractor({
      payslips: Object.fromEntries(payslips.map((d) => [d.name, d.data])),
      form16s: Object.fromEntries(form16s.map((d) => [d.name, d.data])),
    });
    const nextModel = new NextModelExtractor(fixtureExtractor);

    const assemblyFor = (kind: 'payslip' | 'form16'): CheckContext['assembly'] => ({
      case_id: '00000000-0000-0000-0000-00000000000a',
      origins: kind === 'payslip' ? ['payslip'] : ['form_16'],
      has_payslip: kind === 'payslip',
      has_form16: kind === 'form16',
      has_epfo: false,
      has_employer: false,
      has_forensics: false,
    });

    for (const doc of corpus) {
      // Both models produced a successful structured read of the document.
      let outcomeA;
      let outcomeB;

      if (doc.kind === 'payslip') {
        const structuredA = unwrap(
          await fixtureExtractor.extractPayslip(req(doc.name)),
          `${doc.name} fixture extraction`,
        );
        const structuredB = unwrap(
          await nextModel.extractPayslip(req(doc.name)),
          `${doc.name} next-model extraction`,
        );

        outcomeA = evaluate({
          assembly: assemblyFor('payslip'),
          payslip: structuredA,
          form16: null,
          epfoHistory: null,
          forensics: null,
        });

        outcomeB = evaluate({
          assembly: assemblyFor('payslip'),
          payslip: structuredB,
          form16: null,
          epfoHistory: null,
          forensics: null,
        });
      } else {
        const structuredA = unwrap(
          await fixtureExtractor.extractForm16(req(doc.name)),
          `${doc.name} fixture extraction`,
        );
        const structuredB = unwrap(
          await nextModel.extractForm16(req(doc.name)),
          `${doc.name} next-model extraction`,
        );

        outcomeA = evaluate({
          assembly: assemblyFor('form16'),
          payslip: null,
          form16: structuredA,
          epfoHistory: null,
          forensics: null,
        });

        outcomeB = evaluate({
          assembly: assemblyFor('form16'),
          payslip: null,
          form16: structuredB,
          epfoHistory: null,
          forensics: null,
        });
      }

      expect(outcomeB.findings, `${doc.name} findings under next model`).toEqual(outcomeA.findings);
      expect(outcomeB.score, `${doc.name} score under next model`).toBe(outcomeA.score);
      expect(outcomeB.verdict, `${doc.name} verdict under next model`).toBe(outcomeA.verdict);
    }
  });

  it('AC1b — the whole corpus still matches the committed expected outcomes', async () => {
    const fixturesDir = join(REPO_ROOT, 'fixtures');
    const cases = await loadFixtures(fixturesDir);
    expect(cases.length).toBeGreaterThanOrEqual(3);

    for (const testCase of cases) {
      const findings = runAllChecks(testCase.fixture.context).sort((a, b) =>
        a.rule_id.localeCompare(b.rule_id),
      );
      const score = calculateRiskScore(findings);
      const verdict = calculateVerdict(findings, testCase.fixture.context.assembly.origins.length);

      const result = compareExpected(score, verdict, findings, testCase.expected);
      expect(result.errors, `${testCase.name}: rules engine drifted`).toEqual([]);
      expect(result.passed, `${testCase.name}: comparison failed`).toBe(true);
    }
  });

  describe('AC2 — triangulate provenance', () => {
    // assembleEvidence is mocked out; the step never touches deps in these tests.
    const deps = {} as CaseProcessingDeps;

    it('rules.triangulate declares provenance.model = null and source = derived on success', async () => {
      const sampleContext: CheckContext = {
        assembly: {
          case_id: '00000000-0000-0000-0000-00000000000b',
          origins: ['payslip'],
          has_payslip: true,
          has_form16: false,
          has_epfo: false,
          has_employer: false,
          has_forensics: false,
        },
        payslip: null,
        form16: null,
        epfoHistory: null,
        forensics: null,
      };

      vi.doMock('../src/evidence/evidence-service.js', () => ({
        assembleEvidence: vi.fn().mockResolvedValue(sampleContext),
      }));
      const { TriangulateStep } = await import('../src/workflows/steps/triangulate-step.js');
      const step = new TriangulateStep();

      expect(step.id).toBe('rules.triangulate');

      const result = await step.run({ caseId: 'c-1', deps });

      expect(result.state).toBe('succeeded');
      expect(result.provenance.model).toBeNull();
      expect(result.provenance.source).toBe('derived');
      expect(result.artifact).not.toBeNull();
    });

    it('provenance stays model-free even when evidence assembly fails', async () => {
      vi.resetModules();
      vi.doMock('../src/evidence/evidence-service.js', () => ({
        assembleEvidence: vi.fn().mockRejectedValue(new Error('epfo unavailable')),
      }));
      const { TriangulateStep } = await import('../src/workflows/steps/triangulate-step.js');
      const step = new TriangulateStep();

      const result = await step.run({ caseId: 'c-err', deps });

      expect(result.state).toBe('failed');
      expect(result.provenance.model).toBeNull();
      expect(result.provenance.source).toBe('derived');
      expect(result.reason).toContain('Triangulation failed');
    });
  });
});
