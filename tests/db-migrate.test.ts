import { describe, it, expect } from 'vitest';
import { pendingMigrations, needsAutocommit, scrubSql } from '../scripts/lib/migrations.js';

describe('loadEnvFile requiredKeys scoping', () => {
  it('only fails on placeholders for the keys the caller requires', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { loadEnvFile } = await import('../scripts/lib/load-env.js');

    const dir = await mkdtemp(join(tmpdir(), 'envtest-'));
    const envFile = join(dir, '.env.local');
    await writeFile(envFile, 'TEST_DB_MIGRATE_URL=postgres://ok\nTEST_DB_MIGRATE_KEY=<paste-me>\n');

    // Scoped: only TEST_DB_MIGRATE_URL matters; the OPENAI-style placeholder is tolerated.
    expect(() => loadEnvFile(envFile, ['TEST_DB_MIGRATE_URL'])).not.toThrow();

    // Unscoped (default): every unset placeholder is fatal.
    delete process.env.TEST_DB_MIGRATE_KEY;
    expect(() => loadEnvFile(envFile)).toThrow(/unset placeholders for: TEST_DB_MIGRATE_KEY/);
  });
});

describe('migration ordering and pending selection (R4.1/R4.2)', () => {
  it('orders migrations in strict filename order', async () => {
    const { listMigrationFiles } = await import('../scripts/lib/migrations.js');
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const dir = await mkdtemp(join(tmpdir(), 'migrations-'));
    // Written out of order on purpose; listing must still be sorted.
    for (const name of ['0002_b.sql', '0001_a.sql', '0010_c.sql', 'notes.txt']) {
      await writeFile(join(dir, name), '-- noop\n');
    }

    const files = await listMigrationFiles(dir);
    expect(files).toEqual(['0001_a.sql', '0002_b.sql', '0010_c.sql']);
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

  it('flags statements PostgreSQL rejects inside a transaction block', () => {
    expect(needsAutocommit('CREATE INDEX CONCURRENTLY idx ON t(col);')).toBe(true);
    expect(needsAutocommit('CREATE UNIQUE INDEX CONCURRENTLY u ON t(col);')).toBe(true);
    expect(needsAutocommit('REINDEX TABLE CONCURRENTLY t;')).toBe(true);
    expect(needsAutocommit('VACUUM ANALYZE t;')).toBe(true);
  });

  it('does not flag plain DDL', () => {
    expect(needsAutocommit('ALTER TABLE cases ADD COLUMN email varchar(255);')).toBe(false);
    expect(needsAutocommit('CREATE TABLE tokens(hash text PRIMARY KEY);')).toBe(false);
    expect(needsAutocommit('UPDATE cases SET email = lower(email);')).toBe(false);
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
});

describe('SQL scrubbing (scrubSql)', () => {
  it('strips line comments, block comments and dollar-quoted bodies', () => {
    const sql = ['-- a comment', '/* block */ SELECT 1;', 'DO $$ hidden BEGIN body END $$;'].join(
      '\n',
    );
    const out = scrubSql(sql);
    expect(out).not.toContain('-- a comment');
    expect(out).not.toContain('block */');
    expect(out).not.toContain('hidden');
    expect(out).toContain('SELECT 1;');
  });

  it('strips tagged dollar-quoted bodies', () => {
    expect(scrubSql('$fn$ secret $fn$ SELECT 2;')).not.toContain('secret');
  });
});
