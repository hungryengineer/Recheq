import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@tieout/schema', '@tieout/api', '@tieout/rules'],
  turbopack: {},
  serverExternalPackages: ['postgres', 'drizzle-orm', 'pdfjs-dist'],
  // Removed rewrites to Prism API mock as backend is now implemented natively
};

export default nextConfig;
