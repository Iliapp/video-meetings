import type { NextConfig } from 'next';

// Inlined into the client bundle as the upload size pre-check, so a typo
// ("500MB") must fail the build, not silently fall back to the 2 GB default.
const maxBytes = process.env.NEXT_PUBLIC_RECORDINGS_MAX_BYTES;
if (
  maxBytes &&
  !(Number.isSafeInteger(Number(maxBytes)) && Number(maxBytes) > 0)
) {
  throw new Error(
    `NEXT_PUBLIC_RECORDINGS_MAX_BYTES must be a positive integer, got "${maxBytes}"`,
  );
}

const nextConfig: NextConfig = {
  // The e2e web server sets NEXT_DIST_DIR so it can run next to `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
