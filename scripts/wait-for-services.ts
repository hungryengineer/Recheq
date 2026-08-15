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
  const { createConnection } = await import('postgres');
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const sql = createConnection(url);
      await sql`SELECT 1`;
      sql.end();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return false;
}

async function checkHttp(url: string, timeout: number, method = 'GET'): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url, { method });
      if (response.ok || response.status < 500) return true;
    } catch {
      // Silently continue
    }
    await new Promise((r) => setTimeout(r, 1000));
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
