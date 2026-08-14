import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/**
 * Create a Drizzle ORM database instance.
 *
 * @param connectionString - PostgreSQL connection URI
 * @param options - Optional postgres.js driver options (SSL, pool size, etc.)
 * @returns A typed Drizzle instance with the full schema
 */
export function createDb(
  connectionString: string,
  options?: postgres.Options<Record<string, postgres.PostgresType>>,
) {
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ...options,
  });

  return drizzle(client, { schema });
}

/** Re-export the schema for convenience */
export { schema };

/** Type of the database instance returned by createDb */
export type Database = ReturnType<typeof createDb>;
