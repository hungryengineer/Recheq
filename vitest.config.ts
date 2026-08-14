import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/tests/**/*.test.ts', 'services/**/tests/**/*.test.ts', 'apps/**/tests/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
