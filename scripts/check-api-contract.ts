import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const openapiPath = path.join(rootDir, 'contract', 'openapi.yaml');
const apiRoutesDir = path.join(rootDir, 'apps', 'web', 'src', 'app', 'api');

function getImplementedRoutes(dir: string, baseRoute = '/api'): string[] {
  let routes: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Convert Next.js dynamic segment [param] to OpenAPI parameter {param}
      const routeSegment = item.name.replace(/\[(.*?)\]/g, '{$1}');
      routes = routes.concat(getImplementedRoutes(fullPath, `${baseRoute}/${routeSegment}`));
    } else if (item.isFile() && item.name === 'route.ts') {
      routes.push(baseRoute);
    }
  }

  return routes;
}

function checkContract() {
  // Parse OpenAPI YAML
  const fileContents = fs.readFileSync(openapiPath, 'utf8');
  const doc = yaml.load(fileContents) as any;
  const documentedPaths = Object.keys(doc.paths || {});

  // Find implemented routes
  const implementedPaths = getImplementedRoutes(apiRoutesDir);

  let hasError = false;

  const documentedSet = new Set(documentedPaths);
  const implementedSet = new Set(implementedPaths);

  for (const route of implementedPaths) {
    if (!documentedSet.has(route)) {
      console.error(`❌ Undocumented implemented route: ${route}`);
      hasError = true;
    }
  }

  for (const route of documentedPaths) {
    if (!implementedSet.has(route)) {
      console.error(`❌ Documented route is not implemented: ${route}`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error(`\nContract path count (${documentedSet.size}) vs implemented route count (${implementedSet.size}).`);
    console.error('The OpenAPI contract does not match the implemented routes.');
    process.exit(1);
  }

  console.log(`✅ API contract is in sync. All ${implementedSet.size} implemented routes are documented.`);
  process.exit(0);
}

checkContract();
