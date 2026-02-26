import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@linkup/types', '@linkup/validation', '@linkup/utils'],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
