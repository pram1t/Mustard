import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // API server proxy for dev
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3100/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://127.0.0.1:3100/health',
      },
    ];
  },
};

export default nextConfig;
