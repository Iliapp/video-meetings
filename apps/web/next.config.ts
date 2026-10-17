import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The e2e web server sets NEXT_DIST_DIR so it can run next to `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
