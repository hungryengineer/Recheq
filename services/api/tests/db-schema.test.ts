import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema/index.js';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Database Schema', () => {
  it('exports all expected tables', () => {
    expect(schema).toHaveProperty('organizations');
    expect(schema).toHaveProperty('users');
    expect(schema).toHaveProperty('cases');
    expect(schema).toHaveProperty('consents');
    expect(schema).toHaveProperty('documents');
    expect(schema).toHaveProperty('extractions');
    expect(schema).toHaveProperty('forensics');
    expect(schema).toHaveProperty('epfoRecords');
    expect(schema).toHaveProperty('findings');
    expect(schema).toHaveProperty('employerRequests');
    expect(schema).toHaveProperty('events');
  });

  it('cases table carries org_id', () => {
    const config = getTableConfig(schema.cases);
    const orgIdCol = config.columns.find((c) => c.name === 'org_id');
    expect(orgIdCol).toBeDefined();
    expect(orgIdCol?.notNull).toBe(true);
  });

  it('documents table has deduplication unique constraint', () => {
    const config = getTableConfig(schema.documents);
    // Unique constraints might not be exposed easily on columns if defined at table level
    // but we can check if it's defined
    expect(config.uniqueConstraints).toBeDefined();
    const hasDedup = config.uniqueConstraints?.some(
      (u) =>
        u.columns.some((c) => c.name === 'case_id') && u.columns.some((c) => c.name === 'sha256'),
    );
    expect(hasDedup).toBe(true);
  });

  it('events table has sequence unique constraint', () => {
    const config = getTableConfig(schema.events);
    expect(config.uniqueConstraints).toBeDefined();
    const hasSeq = config.uniqueConstraints?.some(
      (u) => u.columns.some((c) => c.name === 'case_id') && u.columns.some((c) => c.name === 'seq'),
    );
    expect(hasSeq).toBe(true);
  });

  it('consents table has token_hash unique constraint', () => {
    const config = getTableConfig(schema.consents);
    const tokenHashCol = config.columns.find((c) => c.name === 'token_hash');
    expect(tokenHashCol).toBeDefined();
    expect(tokenHashCol?.isUnique).toBe(true);
  });

  it('findings table has required columns', () => {
    const config = getTableConfig(schema.findings);
    const colNames = config.columns.map((c) => c.name);

    expect(colNames).toContain('rule_id');
    expect(colNames).toContain('severity');
    expect(colNames).toContain('status');
    expect(colNames).toContain('explanation');
    expect(colNames).toContain('expected');
    expect(colNames).toContain('observed');
    expect(colNames).toContain('source_document_ids');
  });
});
