import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const openapiPath = path.join(rootDir, 'contract', 'openapi.yaml');
const apiRoutesDir = path.join(rootDir, 'apps', 'web', 'src', 'app', 'api');

export interface Operation {
  path: string;
  method: string;
}

export function getImplementedOperations(dir: string, baseRoute = '/api'): Operation[] {
  let operations: Operation[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Convert Next.js dynamic segment [param] to OpenAPI parameter {param}
      const routeSegment = item.name.replace(/\[(.*?)\]/g, '{$1}');
      operations = operations.concat(
        getImplementedOperations(fullPath, `${baseRoute}/${routeSegment}`),
      );
    } else if (item.isFile() && item.name === 'route.ts') {
      const fileContent = fs.readFileSync(fullPath, 'utf8');

      // Match export const GET = ... or export async function POST(...) ...
      const methodRegex =
        /export\s+(?:async\s+)?(?:const|function|let)\s+(GET|POST|PUT|DELETE|PATCH)\b/g;
      let match;
      while ((match = methodRegex.exec(fileContent)) !== null) {
        operations.push({
          path: baseRoute,
          method: match[1]!.toLowerCase(),
        });
      }
    }
  }

  return operations;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function parseDocumentedOperations(fileContents: string): Operation[] {
  const doc = yaml.load(fileContents);

  if (!isObject(doc)) {
    throw new Error('OpenAPI document is not a valid object');
  }

  if (!isObject(doc.paths)) {
    throw new Error('OpenAPI document .paths is missing or not a valid object');
  }

  const operations: Operation[] = [];
  for (const [docPath, methods] of Object.entries(doc.paths)) {
    if (isObject(methods)) {
      for (const method of Object.keys(methods)) {
        operations.push({
          path: docPath,
          method: method.toLowerCase(),
        });
      }
    }
  }

  return operations;
}

export function compareOperations(documented: Operation[], implemented: Operation[]) {
  const documentedSet = new Set(documented.map((o) => `${o.method.toUpperCase()} ${o.path}`));
  const implementedSet = new Set(implemented.map((o) => `${o.method.toUpperCase()} ${o.path}`));

  let hasError = false;
  const errors: string[] = [];

  for (const route of implementedSet) {
    if (!documentedSet.has(route)) {
      errors.push(`❌ Undocumented implemented operation: ${route}`);
      hasError = true;
    }
  }

  for (const route of documentedSet) {
    if (!implementedSet.has(route)) {
      errors.push(`❌ Documented operation is not implemented: ${route}`);
      hasError = true;
    }
  }

  return { hasError, errors, documentedSet, implementedSet };
}

function checkContract() {
  const fileContents = fs.readFileSync(openapiPath, 'utf8');
  let documentedOperations: Operation[];

  try {
    documentedOperations = parseDocumentedOperations(fileContents);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to parse OpenAPI document: ${message}`);
    process.exit(1);
  }

  const implementedOperations = getImplementedOperations(apiRoutesDir);

  const { hasError, errors, documentedSet, implementedSet } = compareOperations(
    documentedOperations,
    implementedOperations,
  );

  if (hasError) {
    for (const error of errors) {
      console.error(error);
    }
    console.error(
      `\nContract operation count (${documentedSet.size}) vs implemented operation count (${implementedSet.size}).`,
    );
    console.error('The OpenAPI contract does not match the implemented operations.');
    process.exit(1);
  }

  console.log(
    `✅ API contract is in sync. All ${implementedSet.size} implemented operations are documented.`,
  );
  process.exit(0);
}

// Only run if executed directly
if (process.argv[1] === __filename) {
  checkContract();
}
