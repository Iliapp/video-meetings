import type { NextConfig } from 'next';

// Inlined into the client bundle as the upload size pre-checks, so a typo
// ("500MB") must fail the build, not silently fall back to the default.
for (const name of [
  'NEXT_PUBLIC_RECORDINGS_MAX_BYTES',
  'NEXT_PUBLIC_AVATAR_MAX_BYTES',
]) {
  const maxBytes = process.env[name];
  if (
    maxBytes &&
    !(Number.isSafeInteger(Number(maxBytes)) && Number(maxBytes) > 0)
  ) {
    throw new Error(`${name} must be a positive integer, got "${maxBytes}"`);
  }
}

const nextConfig: NextConfig = {
  // The e2e web server sets NEXT_DIST_DIR so it can run next to `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
