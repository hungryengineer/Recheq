import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tieout/schema', '@tieout/api', '@tieout/rules'],
  turbopack: {},
  serverExternalPackages: ['postgres', 'drizzle-orm', 'pdfjs-dist'],
};

export default nextConfig;
