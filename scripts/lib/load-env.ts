import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_RE = /^<.*>$/;

/**
 * Load KEY=VALUE pairs from a dotenv-style file (default: .env.local in the
 * current working directory) into process.env.
 *
 * Rules:
 * - Existing env vars are never overridden, so exported/CI values win.
 * - Lines whose value is a `<...>` placeholder are skipped and reported so a
 *   half-configured .env.local fails with a clear message instead of a
 *   confusing connection error.
 * - By default every unset placeholder is fatal. Pass `requiredKeys` to scope
 *   the check to the variables the caller actually needs (e.g. the migration
 *   runner requires DATABASE_URL but not OPENAI_API_KEY).
 */
export function loadEnvFile(file = '.env.local', requiredKeys: readonly string[] | null = null) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) {
    return;
  }

  const missing: string[] = [];

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    if (!key) {
      continue;
    }
    if (PLACEHOLDER_RE.test(value)) {
      const isRequired = requiredKeys === null || requiredKeys.includes(key);
      if (isRequired && process.env[key] === undefined) {
        missing.push(key);
      }
      continue;
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `${file} has unset placeholders for: ${missing.join(', ')} — paste real values before running this script.`,
    );
  }
}
