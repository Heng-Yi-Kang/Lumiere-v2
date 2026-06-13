import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['officeparser'],
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === 'edge') {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        os: false,
        path: false,
      };
    }

    return config;
  },
};

export default nextConfig;
