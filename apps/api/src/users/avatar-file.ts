import { extname } from 'node:path';
import { ConflictException } from '@nestjs/common';
import { fileTypeFromFile } from 'file-type';

export const UNSUPPORTED_AVATAR_MESSAGE =
  'Unsupported file format. Allowed: JPG, PNG, WebP';

// Another upload or delete changed the avatar between reading and writing it.
export const avatarChanged = () =>
  new ConflictException('The avatar was changed by another request, try again');

// The extension decides the stored MIME type; the magic bytes have to match it.
const FORMATS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const mimeTypeFor = (fileName: string) => {
  const ext = extname(fileName).toLowerCase();
  return Object.hasOwn(FORMATS, ext) ? FORMATS[ext] : undefined;
};

// Cheap check on the name alone, so an unsupported file is rejected before its
// body is written to disk.
export const hasAllowedAvatarExtension = (fileName: string): boolean =>
  mimeTypeFor(fileName) !== undefined;

// Reads the first bytes of the stored file. Returns undefined when the
// extension isn't allowed or the content doesn't match it. The client's
// Content-Type is never used.
export async function detectAvatarMimeType(
  path: string,
  originalName: string,
): Promise<string | undefined> {
  const mimeType = mimeTypeFor(originalName);
  if (!mimeType) {
    return undefined;
  }
  const detected = await fileTypeFromFile(path);
  return detected?.mime === mimeType ? mimeType : undefined;
}
