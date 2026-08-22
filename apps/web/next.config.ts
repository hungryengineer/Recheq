import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@tieout/schema', '@tieout/api', '@tieout/rules'],
  turbopack: {},
  serverExternalPackages: ['postgres', 'drizzle-orm', 'pdfjs-dist'],
  // Pin the tracing root to the monorepo root: when `vercel build` runs in
  // apps/web, Next's inference of the workspace root misfires and emits
  // traced paths like "/node_modules/.pnpm/..." which then fail ENOENT
  // during output collection.
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  // Removed rewrites to Prism API mock as backend is now implemented natively
};

export default nextConfig;
