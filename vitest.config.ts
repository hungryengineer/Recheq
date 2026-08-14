import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/tests/**/*.test.ts', 'services/**/tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'coverage/**'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
