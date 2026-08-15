/**
 * Wait for required services to be healthy
 */

interface ServiceCheck {
  name: string;
  url: string;
  method?: string;
  timeout: number;
}

const services: ServiceCheck[] = [
  {
    name: 'PostgreSQL',
    url: 'postgresql://postgres:postgres@localhost:5432/tieout',
    timeout: 30000,
  },
  {
    name: 'MinIO',
    url: 'http://localhost:9000/minio/health/live',
    method: 'GET',
    timeout: 30000,
  },
  {
    name: 'Mailpit',
    url: 'http://localhost:8025',
    method: 'GET',
    timeout: 30000,
  },
];

async function checkPostgres(url: string, timeout: number): Promise<boolean> {
  const { default: postgres } = await import('postgres');
  const start = Date.now();

  while (Date.now() - start < timeout) {
    let sql;
    try {
      sql = postgres(url, { max: 1 });
      await sql`SELECT 1`;
      return true;
    } catch {
      const remaining = timeout - (Date.now() - start);
      if (remaining <= 0) break;
      await new Promise((r) => setTimeout(r, Math.min(1000, remaining)));
    } finally {
      if (sql) await sql.end();
    }
  }

  return false;
}

async function checkHttp(url: string, timeout: number, method = 'GET'): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const remaining = timeout - (Date.now() - start);
    if (remaining <= 0) break;

    try {
      const response = await fetch(url, { method, signal: AbortSignal.timeout(remaining) });
      if (response.ok) return true;
    } catch {
      // Silently continue
    }
    const sleepRemaining = timeout - (Date.now() - start);
    if (sleepRemaining > 0) {
      await new Promise((r) => setTimeout(r, Math.min(1000, sleepRemaining)));
    }
  }

  return false;
}

export async function waitForServices(): Promise<void> {
  console.log('Waiting for services...\n');

  for (const service of services) {
    process.stdout.write(`  ${service.name}... `);

    let healthy = false;
    if (service.name === 'PostgreSQL') {
      healthy = await checkPostgres(service.url, service.timeout);
    } else {
      healthy = await checkHttp(service.url, service.timeout, service.method);
    }

    if (healthy) {
      console.log('✓');
    } else {
      console.log('✗');
      throw new Error(`${service.name} did not become healthy`);
    }
  }

  console.log('\nAll services healthy!\n');
}

if (import.meta.main) {
  waitForServices().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
