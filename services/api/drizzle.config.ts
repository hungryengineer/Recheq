import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema',
  out: '../../db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/recheq',
  },
});
