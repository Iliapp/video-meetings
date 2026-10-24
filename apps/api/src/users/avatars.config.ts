import { resolve } from 'node:path';
import { ConfigType, registerAs } from '@nestjs/config';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const parseAvatarMaxBytes = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_MAX_BYTES;
  }
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error(
      `AVATAR_MAX_BYTES must be a positive integer, got "${value}"`,
    );
  }
  return bytes;
};

// Read once at startup; a bad AVATAR_MAX_BYTES stops the app from booting.
export const avatarsConfig = registerAs('avatars', () => ({
  // Relative paths resolve against the api's working directory.
  dir: resolve(process.env.AVATARS_DIR || 'avatars'),
  maxBytes: parseAvatarMaxBytes(process.env.AVATAR_MAX_BYTES),
}));

export type AvatarsConfig = ConfigType<typeof avatarsConfig>;
