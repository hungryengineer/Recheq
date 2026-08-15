import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tieout/schema', '@tieout/api', '@tieout/rules'],
};

export default nextConfig;
