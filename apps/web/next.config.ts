import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@recheq/schema', '@recheq/api', '@recheq/rules'],
  turbopack: {},
  serverExternalPackages: ['postgres', 'drizzle-orm', 'pdfjs-dist'],
  // Pin the tracing root to the monorepo root only on Vercel: when `vercel build` runs in
  // apps/web, Next's inference of the workspace root misfires. However, setting this in
  // a standard workspace build (like in GitHub Actions) breaks Next's tracing paths.
  outputFileTracingRoot: process.env.VERCEL
    ? path.join(import.meta.dirname, '..', '..')
    : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Removed rewrites to Prism API mock as backend is now implemented natively
};

export default nextConfig;
