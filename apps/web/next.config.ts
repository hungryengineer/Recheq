import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@tieout/schema', '@tieout/api', '@tieout/rules'],
  turbopack: {},
  serverExternalPackages: ['postgres', 'drizzle-orm', 'pdfjs-dist'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL || 'http://localhost:4010'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
