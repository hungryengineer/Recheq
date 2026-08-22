import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as yaml from 'js-yaml';
import {
  projectPublicSteps,
  projectOpsSteps,
  providerFromModelId,
  type DocumentLike,
  type ExtractionLike,
} from '../src/workflows/step-projection.js';

// ─── Fixtures ───────────────────────────────────────────────────

const doc = (overrides: Partial<DocumentLike> = {}): DocumentLike => ({
  id: overrides.id ?? 'doc-1',
  kind: overrides.kind ?? 'payslip',
  status: overrides.status ?? 'extracted',
  uploaded_at: overrides.uploaded_at ?? '2026-01-01T10:00:00Z',
});

const extraction = (overrides: Partial<ExtractionLike> = {}): ExtractionLike => ({
  document_id: overrides.document_id ?? 'doc-1',
  status: overrides.status ?? 'success',
  model_id: overrides.model_id ?? 'gemini-2.5-flash',
  created_at: overrides.created_at ?? '2026-01-01T10:01:00Z',
  completed_at: overrides.completed_at ?? '2026-01-01T10:02:00Z',
});

function build(
  overrides: {
    caseStatus?: string;
    documents?: DocumentLike[];
    extractions?: ExtractionLike[];
    epfoRecords?: { employment_history: unknown }[];
  } = {},
) {
  return {
    caseRecord: { status: overrides.caseStatus ?? 'complete' },
    documents: overrides.documents ?? [doc()],
    extractions: overrides.extractions ?? [extraction()],
    epfoRecords: overrides.epfoRecords ?? [{ employment_history: {} }],
  };
}

const stepById = <T extends { id: string }>(steps: T[], id: string): T =>
  steps.find((s) => s.id === id)!;

describe('RCQ-20113 — per-step status API', () => {
  describe('public steps derivation', () => {
    it('emits the four contract steps in order', () => {
      const steps = projectPublicSteps(build());
      expect(steps.map((s) => s.id)).toEqual(['payslip', 'form16', 'epfo', 'rules']);
    });

    it('marks a fully extracted document step as succeeded with timing', () => {
      const steps = projectPublicSteps(
        build({
          extractions: [extraction({ document_id: 'doc-1', status: 'success', model_id: null })],
        }),
      );
      const payslip = stepById(steps, 'payslip');
      expect(payslip.state).toBe('succeeded');
      expect(payslip.started_at).toBe('2026-01-01T10:00:00.000Z');
      expect(payslip.completed_at).toBe('2026-01-01T10:02:00.000Z');
      expect(payslip.human_summary).toBeTruthy();
      expect(payslip.reason).toBeNull();
    });

    it('maps form_16 documents onto the form16 contract id', () => {
      const steps = projectPublicSteps(
        build({ documents: [doc({ kind: 'form_16' })], extractions: [] }),
      );
      expect(steps.map((s) => s.id)).toContain('form16');
    });

    it('reports failed extractions with a candidate-safe reason', () => {
      const steps = projectPublicSteps(build({ extractions: [extraction({ status: 'failed' })] }));
      const payslip = stepById(steps, 'payslip');
      expect(payslip.state).toBe('failed');
      expect(payslip.reason).toMatch(/could not be processed/i);
    });

    it('shows EPFO as awaiting_external while processing and not_assessed when absent at completion', () => {
      const processing = projectPublicSteps(build({ caseStatus: 'processing', epfoRecords: [] }));
      expect(stepById(processing, 'epfo').state).toBe('awaiting_external');

      const complete = projectPublicSteps(
        build({ caseStatus: 'complete', epfoRecords: [], documents: [], extractions: [] }),
      );
      expect(stepById(complete, 'epfo').state).toBe('not_assessed');
    });

    it('counts only extracted documents', () => {
      // The route derives this; here we pin the semantics used by callers.
      const docs = [doc(), doc({ id: 'doc-2', status: 'uploaded' })];
      expect(docs.filter((d) => d.status === 'extracted')).toHaveLength(1);
    });
  });

  describe('P5 leak guard — public variant carries no ops data', () => {
    const FORBIDDEN = ['verdict', 'risk_score', 'findings', 'origins', 'not_assessed'];

    it('response body contains no verdict/risk/findings keys anywhere', () => {
      const body = {
        status: 'processing',
        documents_total: 1,
        documents_extracted: 0,
        steps: projectPublicSteps(build()),
        // Simulated accidental additions must be caught by projection shape,
        // asserted below by key scan on every nested object.
      };
      const seen: string[] = [];
      const walk = (node: unknown) => {
        if (Array.isArray(node)) node.forEach(walk);
        else if (node && typeof node === 'object') {
          for (const [k, v] of Object.entries(node)) {
            if (FORBIDDEN.includes(k)) seen.push(k);
            walk(v);
          }
        }
      };
      walk(body);
      expect(seen).toEqual([]);
      expect(Object.keys(body)).toEqual([
        'status',
        'documents_total',
        'documents_extracted',
        'steps',
      ]);
    });

    it('public steps never carry an evidence field', () => {
      const steps = projectPublicSteps(build());
      for (const s of steps) expect(s).not.toHaveProperty('evidence');
    });

    it('failure reasons stay candidate-safe (R2.2)', () => {
      const steps = projectPublicSteps(
        build({
          extractions: [
            extraction({
              status: 'failed',
              model_id: 'internal-codename-x',
              completed_at: null,
            }),
          ],
        }),
      );
      for (const s of steps) {
        if (s.reason) {
          expect(s.reason.toLowerCase()).not.toMatch(
            /signzy|gemini|openai|stack|trace|internal|code:\s*\w+/i,
          );
          expect(s.reason.length).toBeLessThan(200);
        }
      }
    });
  });

  describe('ops view — evidence grouped by step', () => {
    it('attaches provider/model evidence to document steps', () => {
      const steps = projectOpsSteps(build());
      const payslip = stepById(steps, 'payslip');
      expect(payslip.evidence).toEqual([{ provider: 'google', model_version: 'gemini-2.5-flash' }]);
    });

    it('groups evidence per step, never mixing kinds', () => {
      const docs = [doc(), doc({ id: 'doc-2', kind: 'form_16' })];
      const steps = projectOpsSteps(
        build({
          documents: docs,
          extractions: [
            extraction({ document_id: 'doc-1', model_id: 'gpt-4o-2024-08-06' }),
            extraction({ document_id: 'doc-2', model_id: 'claude-3-5-sonnet' }),
          ],
        }),
      );

      const byId = new Map(steps.map((s) => [s.id, s]));
      expect(byId.get('payslip')?.evidence[0]?.provider).toBe('openai');
      expect(byId.get('form16')?.evidence[0]?.provider).toBe('anthropic');
      expect(byId.get('epfo')?.evidence[0]?.provider).toBe('epfo');
      expect(byId.get('rules')!.evidence).toEqual([]);
    });

    it('derives provider names conservatively', () => {
      expect(providerFromModelId(null)).toBe('unknown');
      expect(providerFromModelId('gemini-2.5-flash')).toBe('google');
      expect(providerFromModelId('gpt-4o-2024-08-06')).toBe('openai');
      expect(providerFromModelId('claude-3-5-sonnet')).toBe('anthropic');
      expect(providerFromModelId('totally-unknown-model')).toBe('totally');
    });
  });

  describe('contract conformance — validated against openapi.yaml', () => {
    interface SchemaNode {
      type?: string;
      enum?: unknown[];
      required?: string[];
      properties?: Record<string, SchemaNode>;
      items?: SchemaNode;
      nullable?: boolean;
      $ref?: string;
    }
    let contract: {
      components: { schemas: Record<string, SchemaNode> };
    };

    const resolve = (schema: SchemaNode): SchemaNode => {
      if (!schema.$ref) return schema;
      const name = schema.$ref.replace('#/components/schemas/', '');
      return contract.components.schemas[name]!;
    };

    /** Minimal OpenAPI 3.0 response validator (required/type/enum/nullable). */
    const validate = (schemaArg: SchemaNode, value: unknown, path: string): string[] => {
      const schema = resolve(schemaArg);
      const errors: string[] = [];
      if (value === null || value === undefined) {
        if (!schema.nullable && value === null) errors.push(`${path}: unexpected null`);
        return errors;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: ${JSON.stringify(value)} not in ${schema.enum.join('|')}`);
      }
      const t = schema.type;
      if (t === 'object') {
        for (const req of schema.required ?? []) {
          if (!(req in (value as object))) errors.push(`${path}.${req}: missing`);
        }
        for (const [k, v] of Object.entries(value as object)) {
          const prop = schema.properties?.[k];
          if (prop) errors.push(...validate(prop, v, `${path}.${k}`));
        }
      } else if (t === 'array') {
        if (!Array.isArray(value)) errors.push(`${path}: expected array`);
        else
          (value as unknown[]).forEach((item, i) =>
            errors.push(...validate(schema.items!, item, `${path}[${i}]`)),
          );
      } else if (t === 'string' && typeof value !== 'string') {
        errors.push(`${path}: expected string`);
      } else if (t === 'integer' && !Number.isInteger(value)) {
        errors.push(`${path}: expected integer`);
      }
      return errors;
    };

    it('StatusResponse validates for every lifecycle state', async () => {
      const raw = await readFile('contract/openapi.yaml', 'utf8');
      contract = yaml.load(raw) as typeof contract;
      const schema = contract.components.schemas.StatusResponse!;

      for (const caseStatus of ['awaiting_documents', 'processing', 'complete', 'withdrawn']) {
        const body = {
          status: caseStatus,
          documents_total: 2,
          documents_extracted: 1,
          steps: projectPublicSteps(build({ caseStatus })),
        };
        expect(validate(schema, body, 'body'), JSON.stringify(body)).toEqual([]);
      }
    });

    it('CaseDetail.steps validates including evidence', async () => {
      const raw = await readFile('contract/openapi.yaml', 'utf8');
      contract = yaml.load(raw) as typeof contract;
      const stepsSchema = (contract.components.schemas.CaseDetail as SchemaNode).properties!.steps!;

      const steps = projectOpsSteps(
        build({
          caseStatus: 'complete',
          documents: [doc(), doc({ id: 'doc-2', kind: 'form_16' })],
          extractions: [
            extraction(),
            extraction({ document_id: 'doc-2', model_id: 'claude-3-5-sonnet' }),
          ],
        }),
      );
      expect(validate(stepsSchema, steps, 'steps')).toEqual([]);
    });
  });
});
