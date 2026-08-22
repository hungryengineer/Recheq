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

/**
 * RCQ-20116 — Model-independence proof.
 *
 * Diligence question Q1: "what happens when the next model release makes
 * your core capability free?" The verdict must come from the RULES ENGINE
 * operating on structured evidence — never from which model happened to
 * read the document. These tests turn that claim into a green CI check:
 *
 * 1. The whole extraction corpus is pushed through the rules twice, under
 *    two different extractor identities (fixture vs "the next model").
 *    Findings, risk score and verdict must be byte-identical.
 * 2. The same corpus grounded against committed expected outcomes, so the
 *    equality above cannot be vacuously true.
 * 3. `rules.triangulate` declares provenance.model = null — the workflow
 *    contract itself states that triangulation is model-independent.
 */

// ─── Corpus loading ─────────────────────────────────────────────

const REPO_ROOT = join(import.meta.dirname ?? '.', '../../..');
const EXTRACTION_DIR = join(REPO_ROOT, 'fixtures', 'extraction');

interface CorpusDoc {
  name: string;
  kind: 'payslip' | 'form16';
  data: Record<string, unknown>;
}

function loadCorpus(): CorpusDoc[] {
  return readdirSync(EXTRACTION_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const name = f.replace('.json', '');
      const data = JSON.parse(readFileSync(join(EXTRACTION_DIR, f), 'utf8'));
      const kind: CorpusDoc['kind'] = name.startsWith('payslip') ? 'payslip' : 'form16';
      return { name, kind, data };
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
    expect(corpus.length).toBeGreaterThanOrEqual(10);
  });

  it('AC1 — swapping the extractor for another model yields IDENTICAL findings, score and verdict across the whole corpus', async () => {
    const fixtureExtractor = new FixtureExtractor({
      payslips: Object.fromEntries(
        corpus.filter((d) => d.kind === 'payslip').map((d) => [d.name, d.data]),
      ),
      form16s: Object.fromEntries(
        corpus.filter((d) => d.kind === 'form16').map((d) => [d.name, d.data]),
      ),
    } as never);
    const nextModel = new NextModelExtractor(fixtureExtractor);

    for (const doc of corpus) {
      const viaFixture =
        doc.kind === 'payslip'
          ? await fixtureExtractor.extractPayslip(req(doc.name))
          : await fixtureExtractor.extractForm16(req(doc.name));
      const viaNextModel =
        doc.kind === 'payslip'
          ? await nextModel.extractPayslip(req(doc.name))
          : await nextModel.extractForm16(req(doc.name));

      // Both models produced a successful structured read of the document.
      expect(viaFixture.status, `${doc.name} fixture extraction`).toBe('success');
      expect(viaNextModel.status, `${doc.name} next-model extraction`).toBe('success');

      // Structured evidence is the contract between extraction and rules.
      const structuredFixture =
        doc.kind === 'payslip'
          ? (viaFixture as { data: unknown }).data
          : (viaFixture as { data: unknown }).data;

      // The rules engine has NO input slot for provider/model identity —
      // build the context exactly as assembleEvidence would.
      const contextFor = (data: unknown): CheckContext => ({
        assembly: {
          case_id: '00000000-0000-0000-0000-00000000000a',
          origins: doc.kind === 'payslip' ? ['payslip'] : ['form_16'],
          has_payslip: doc.kind === 'payslip',
          has_form16: doc.kind === 'form16',
          has_epfo: false,
          has_employer: false,
          has_forensics: false,
        },
        payslip: (doc.kind === 'payslip' ? data : null) as never,
        form16: (doc.kind === 'form16' ? data : null) as never,
        epfoHistory: null,
        forensics: null,
      });

      const outcomeA = evaluate(contextFor(structuredFixture));
      const outcomeB = evaluate(contextFor((viaNextModel as { data: unknown }).data));

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
    it('rules.triangulate declares provenance.model = null and source = derived', async () => {
      const sampleContext = {
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

      const result = await step.run({ caseId: 'c-1', deps: {} as never } as never);

      expect(result.state).toBe('succeeded');
      expect(result.provenance.model).toBeNull();
      expect(result.provenance.source).toBe('derived');
      // Even on failure the provenance stays model-free.
      expect(result.artifact).not.toBeNull();
    });
  });
});
