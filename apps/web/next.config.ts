import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tieout/schema', '@tieout/api', '@tieout/rules'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/:path*',
          destination: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
