import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{source:'/api/:path*',destination:`${process.env.API_INTERNAL_URL || 'http://127.0.0.1:8000'}/:path*`}];
  },
};
export default config;
