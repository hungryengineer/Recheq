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
 * Removes SQL comments (-- line and nested-capable block comments) and
 * dollar-quoted bodies ($$...$$ or $tag$...$tag$), and blanks out the contents
 * of single-quoted string literals, so classification only ever sees
 * executable SQL.
 *
 * This is a character-level scanner rather than a regex pipeline: regexes
 * cannot tell `SELECT 'VACUUM'` from a real VACUUM, would treat a `'--'`
 * literal as a comment opener, and PostgreSQL block comments nest — none of
 * which the classifier may trip on.
 */
export function scrubSql(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    // Line comment: skip through end of line (newline kept via main loop).
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i += 1;
      continue;
    }

    // Block comment with nesting (PostgreSQL supports /* /* */ */).
    if (ch === '/' && sql[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth += 1;
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      out += ' ';
      continue;
    }

    // Single-quoted string literal ('' is an escaped quote): blank the body
    // but keep the quotes so statement structure survives scrubbing.
    if (ch === "'") {
      i += 1;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      out += "''";
      continue;
    }

    // Dollar-quoted string ($$ or $tag$): strip body entirely.
    if (ch === '$') {
      const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (match) {
        const tag = match[0];
        const end = sql.indexOf(tag, i + tag.length);
        i = end === -1 ? n : end + tag.length;
        out += ' ';
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Returns the .sql files in `dir`, sorted in strict filename order (R4.1). */
export async function listMigrationFiles(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.sql')).sort();
  } catch (cause) {
    throw new Error(`Cannot list migrations in ${dir}: ${String(cause)}`, { cause });
  }
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
