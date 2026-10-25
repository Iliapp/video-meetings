import { extensionOf, formatBytes } from './recordings';

// Same allow-list and limit as the api, checked before an upload starts, so
// the user sees the reason without a request. The api still checks the real
// file type.
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** For the file picker: MIME types plus extensions. */
export const ACCEPTED_AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  ...EXTENSIONS,
];

export const MAX_AVATAR_BYTES =
  Number(process.env.NEXT_PUBLIC_AVATAR_MAX_BYTES) || 5 * 1024 ** 2;

export const UNSUPPORTED_AVATAR_MESSAGE =
  'Unsupported file format. Allowed: JPG, PNG, WebP';

export const AVATAR_FORMATS_HINT = `JPG, PNG or WebP, up to ${formatBytes(MAX_AVATAR_BYTES)}`;

/** The reason a file can't be an avatar, or `null` when it can. */
export function validateAvatarFile(file: File): string | null {
  if (!EXTENSIONS.includes(extensionOf(file.name))) {
    return UNSUPPORTED_AVATAR_MESSAGE;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `File is larger than ${formatBytes(MAX_AVATAR_BYTES)}`;
  }
  return null;
}
