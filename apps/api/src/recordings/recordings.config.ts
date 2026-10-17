import { resolve } from 'node:path';
import { ConfigType, registerAs } from '@nestjs/config';

const DEFAULT_MAX_BYTES = 2 * 1024 ** 3; // 2 GB

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

// Read once at startup; a bad RECORDINGS_MAX_BYTES stops the app from booting.
export const recordingsConfig = registerAs('recordings', () => ({
  // Relative paths resolve against the api's working directory.
  dir: resolve(process.env.RECORDINGS_DIR || 'recordings'),
  maxBytes: parseMaxBytes(process.env.RECORDINGS_MAX_BYTES),
}));

export type RecordingsConfig = ConfigType<typeof recordingsConfig>;
