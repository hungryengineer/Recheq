import { describe, it, expect } from 'vitest';
import { pendingMigrations, needsAutocommit, scrubSql } from '../scripts/lib/migrations.js';

describe('loadEnvFile requiredKeys scoping', () => {
  it('only fails on placeholders for the keys the caller requires', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { loadEnvFile } = await import('../scripts/lib/load-env.js');

    const savedUrl = process.env.TEST_DB_MIGRATE_URL;
    const savedKey = process.env.TEST_DB_MIGRATE_KEY;
    let envFile: string;
    try {
      const dir = await mkdtemp(join(tmpdir(), 'envtest-'));
      envFile = join(dir, '.env.local');
      await writeFile(
        envFile,
        'TEST_DB_MIGRATE_URL=postgres://ok\nTEST_DB_MIGRATE_KEY=<paste-me>\n',
      );
    } catch (err) {
      throw new Error(`Failed to prepare loadEnvFile fixture: ${String(err)}`, {
        cause: err,
      });
    }

    try {
      // Scoped: only TEST_DB_MIGRATE_URL matters; the unrelated placeholder is tolerated.
      expect(() => loadEnvFile(envFile, ['TEST_DB_MIGRATE_URL'])).not.toThrow();

      // Unscoped (default): every unset placeholder is fatal.
      delete process.env.TEST_DB_MIGRATE_KEY;
      expect(() => loadEnvFile(envFile)).toThrow(/unset placeholders for: TEST_DB_MIGRATE_KEY/);
    } finally {
      if (savedUrl === undefined) delete process.env.TEST_DB_MIGRATE_URL;
      else process.env.TEST_DB_MIGRATE_URL = savedUrl;
      if (savedKey === undefined) delete process.env.TEST_DB_MIGRATE_KEY;
      else process.env.TEST_DB_MIGRATE_KEY = savedKey;
    }
  });
});

describe('migration ordering and pending selection (R4.1/R4.2)', () => {
  it('orders migrations in strict filename order', async () => {
    const { listMigrationFiles } = await import('../scripts/lib/migrations.js');
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    let dir: string;
    try {
      dir = await mkdtemp(join(tmpdir(), 'migrations-'));
      // Written out of order on purpose; listing must still be sorted.
      for (const name of ['0002_b.sql', '0001_a.sql', '0010_c.sql', 'notes.txt']) {
        await writeFile(join(dir, name), '-- noop\n');
      }
    } catch (err) {
      throw new Error(`Failed to prepare migrations fixture: ${String(err)}`, { cause: err });
    }

    const files = await listMigrationFiles(dir);
    expect(files).toEqual(['0001_a.sql', '0002_b.sql', '0010_c.sql']);
  });

  it('wraps discovery failures with the directory context', async () => {
    const { listMigrationFiles } = await import('../scripts/lib/migrations.js');
    await expect(listMigrationFiles('/definitely/not/a/real/dir-rcq20105')).rejects.toThrow(
      /Cannot list migrations in/,
    );
  });

  it('selects only unapplied migrations, preserving order', () => {
    const files = ['0001_a.sql', '0002_b.sql', '0002_c.sql'];
    const applied = new Set(['0001_a.sql']);
    expect(pendingMigrations(files, applied)).toEqual(['0002_b.sql', '0002_c.sql']);
  });

  it('selects nothing when every migration is applied (idempotent run)', () => {
    const files = ['0001_a.sql', '0002_b.sql'];
    const applied = new Set(files);
    expect(pendingMigrations(files, applied)).toEqual([]);
  });
});

describe('autocommit classification (needsAutocommit)', () => {
  it('flags files that manage their own transaction', () => {
    expect(needsAutocommit('BEGIN;\nCREATE TABLE t(id int);\nCOMMIT;')).toBe(true);
    expect(needsAutocommit('start transaction;\nselect 1;')).toBe(true);
  });

  it('flags every statement PostgreSQL rejects inside a transaction block', () => {
    expect(needsAutocommit('CREATE INDEX CONCURRENTLY idx ON t(col);')).toBe(true);
    expect(needsAutocommit('CREATE UNIQUE INDEX CONCURRENTLY u ON t(col);')).toBe(true);
    expect(needsAutocommit('DROP INDEX CONCURRENTLY idx;')).toBe(true);
    expect(needsAutocommit('REINDEX TABLE CONCURRENTLY t;')).toBe(true);
    expect(needsAutocommit('REINDEX INDEX CONCURRENTLY idx;')).toBe(true);
    expect(needsAutocommit('VACUUM ANALYZE t;')).toBe(true);
    expect(needsAutocommit('CREATE DATABASE app;')).toBe(true);
    expect(needsAutocommit('DROP DATABASE app;')).toBe(true);
  });

  it('does not flag plain DDL/DML', () => {
    expect(needsAutocommit('ALTER TABLE cases ADD COLUMN email varchar(255);')).toBe(false);
    expect(needsAutocommit('CREATE TABLE tokens(hash text PRIMARY KEY);')).toBe(false);
    expect(needsAutocommit('UPDATE cases SET email = lower(email);')).toBe(false);
    expect(needsAutocommit('DROP INDEX idx;')).toBe(false);
  });

  it('ignores transaction words inside comments and dollar-quoted bodies', () => {
    const tricky = [
      '-- BEGIN appears only in a comment',
      "DO $$ BEGIN RAISE NOTICE 'hi'; END $$;",
      'CREATE FUNCTION f() RETURNS void AS $body$ BEGIN NULL; END $body$ LANGUAGE plpgsql;',
      '/* START TRANSACTION in a block comment */',
      'ALTER TABLE t ADD COLUMN c int;',
    ].join('\n');
    expect(needsAutocommit(tricky)).toBe(false);
  });

  it("does not classify tokens inside string literals ('VACUUM', 'BEGIN')", () => {
    expect(needsAutocommit("SELECT 'VACUUM';")).toBe(false);
    expect(needsAutocommit("SELECT 'BEGIN';")).toBe(false);
    expect(needsAutocommit("SELECT 'it''s a VACUUM day';")).toBe(false);
  });

  it('does not treat quote/comment markers inside literals as comments', () => {
    // The '--' literal must not swallow the rest of the statement as a comment.
    expect(needsAutocommit("SELECT '--'; CREATE INDEX CONCURRENTLY idx ON t(col);")).toBe(true);
    // Same for the block-comment marker inside a literal.
    expect(needsAutocommit("SELECT '/*'; CREATE INDEX CONCURRENTLY idx ON t(col);")).toBe(true);
  });

  it('handles nested PostgreSQL block comments', () => {
    // Nested comment fully consumed; the trailing statement still classifies.
    expect(
      needsAutocommit('/* outer /* inner */ still comment */ CREATE INDEX CONCURRENTLY i ON t(c);'),
    ).toBe(true);
    // Classifier token hidden inside a nested comment stays hidden.
    expect(needsAutocommit('/* outer /* VACUUM */ inner */ ALTER TABLE t ADD COLUMN c int;')).toBe(
      false,
    );
  });
});

describe('SQL scrubbing (scrubSql)', () => {
  it('strips line comments, block comments and dollar-quoted bodies', () => {
    const sql = [
      '-- a comment',
      'SELECT 1;',
      'DO $$ hidden BEGIN body END $$;',
      '$fn$ tagged secret $fn$ SELECT 2;',
    ].join('\n');
    const out = scrubSql(sql);
    expect(out).not.toContain('-- a comment');
    expect(out).not.toContain('hidden');
    expect(out).not.toContain('secret');
    expect(out).toContain('SELECT 1;');
    expect(out).toContain('SELECT 2;');
  });

  it('blanks string-literal bodies while preserving quotes and structure', () => {
    const out = scrubSql("SELECT 'VACUUM' FROM t;");
    expect(out).not.toContain('VACUUM');
    expect(out).toContain("SELECT ''");
    expect(out).toContain('FROM t;');
  });

  it('handles escaped quotes in literals', () => {
    const out = scrubSql("SELECT 'it''s -- fine' , 1;");
    expect(out).not.toContain('-- fine');
    expect(out).toContain(', 1;');
  });
});
