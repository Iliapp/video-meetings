import { resolve } from 'node:path';
import { ConfigType, registerAs } from '@nestjs/config';
import { parsePublicUrl } from '../common/public-url';

const DEFAULT_MAX_BYTES = 2 * 1024 ** 3; // 2 GB
// Long enough to watch a long meeting without refetching the URLs.
const DEFAULT_URL_TTL_SECONDS = 6 * 60 * 60;
const TTL_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

const parseMaxBytes = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_MAX_BYTES;
  }
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error(
      `RECORDINGS_MAX_BYTES must be a positive integer, got "${value}"`,
    );
  }
  return bytes;
};

// "90" (seconds), "30s", "15m", "6h" or "1d", like JWT_EXPIRES_IN.
export const parseUrlTtl = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_URL_TTL_SECONDS;
  }
  const match = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  const seconds = match ? Number(match[1]) * TTL_UNITS[match[2] || 's'] : 0;
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(
      `RECORDING_URL_TTL must be a positive duration like "6h", got "${value}"`,
    );
  }
  return seconds;
};

// Read once at startup; a bad RECORDINGS_MAX_BYTES, RECORDING_URL_TTL or
// API_PUBLIC_URL stops the app from booting.
export const recordingsConfig = registerAs('recordings', () => ({
  // Relative paths resolve against the api's working directory.
  dir: resolve(process.env.RECORDINGS_DIR || 'recordings'),
  maxBytes: parseMaxBytes(process.env.RECORDINGS_MAX_BYTES),
  urlTtlSeconds: parseUrlTtl(process.env.RECORDING_URL_TTL),
  publicUrl: parsePublicUrl(process.env.API_PUBLIC_URL),
}));

export type RecordingsConfig = ConfigType<typeof recordingsConfig>;
