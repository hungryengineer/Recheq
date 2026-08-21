/**
 * Pure helpers for the migration runner (scripts/db-migrate.ts).
 *
 * Kept free of I/O and side effects so the ordering, pending-selection and
 * autocommit classification rules are unit-testable without a database.
 */

/**
 * Decides whether a migration must run in autocommit mode (outside the wrapping
 * transaction). Two categories qualify:
 *
 * 1. Files that manage their own transaction (top-level BEGIN / START TRANSACTION).
 * 2. Files containing statements PostgreSQL rejects inside a transaction block:
 *    CREATE/DROP INDEX CONCURRENTLY, REINDEX CONCURRENTLY, VACUUM,
 *    CREATE DATABASE, DROP DATABASE.
 *
 * The scan strips comments and dollar-quoted bodies first so transaction-control
 * words inside DO blocks, function bodies, or comments cannot trip the classifier,
 * and it detects all CONCURRENTLY variants (including CREATE UNIQUE INDEX
 * CONCURRENTLY and REINDEX TABLE ... CONCURRENTLY).
 */
export function needsAutocommit(sql: string): boolean {
  const scrubbed = scrubSql(sql);

  if (/^\s*(BEGIN|START\s+TRANSACTION)\b/im.test(scrubbed)) {
    return true;
  }

  return (
    /(CREATE|DROP)\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/im.test(scrubbed) ||
    /\bREINDEX\s+(?:(?:UNIQUE\s+)?(?:TABLE|INDEX|SCHEMA|DATABASE|SYSTEM)\s+)?CONCURRENTLY\b/im.test(
      scrubbed,
    ) ||
    /\bVACUUM\b/im.test(scrubbed) ||
    /(CREATE|DROP)\s+DATABASE\b/im.test(scrubbed)
  );
}

/**
 * Removes SQL comments (-- line and /* block) and dollar-quoted bodies
 * ($$...$$ or $tag$...$tag$) so classification sees only executable SQL.
 */
export function scrubSql(sql: string): string {
  return sql
    .replace(/\$[A-Za-z_][A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$[\s\S]*?\$\$/g, '')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Returns the .sql files in `dir`, sorted in strict filename order (R4.1). */
export async function listMigrationFiles(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir);
  return entries.filter((f) => f.endsWith('.sql')).sort();
}

/**
 * Returns the subset of `files` (in the same order) that has not been applied
 * yet according to `appliedNames` — i.e. what a run would execute.
 */
export function pendingMigrations(
  files: readonly string[],
  appliedNames: ReadonlySet<string>,
): string[] {
  return files.filter((f) => !appliedNames.has(f));
}
