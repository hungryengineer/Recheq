import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tieout/schema', '@tieout/api', '@tieout/rules'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs']
    };
    return config;
  }
};

export default nextConfig;
