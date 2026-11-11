import { basename, extname } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import { RecordingKind } from '../generated/prisma/client';

export const UNSUPPORTED_FORMAT_MESSAGE =
  'Unsupported file format. Allowed: MP4, WebM, MP3, M4A, WAV';

export interface RecordingFormat {
  mimeType: string;
  kind: RecordingKind;
}

// The extension decides the stored MIME type and kind; the magic bytes only
// have to confirm the container. MP4 and M4A share the ISO-BMFF container and
// encoders often write an MP4 brand into .m4a files, so both are accepted.
const FORMATS: Record<string, RecordingFormat & { detected: string[] }> = {
  '.mp4': {
    mimeType: 'video/mp4',
    kind: RecordingKind.video,
    detected: ['video/mp4', 'video/x-m4v'],
  },
  '.webm': {
    mimeType: 'video/webm',
    kind: RecordingKind.video,
    detected: ['video/webm'],
  },
  '.mp3': {
    mimeType: 'audio/mpeg',
    kind: RecordingKind.audio,
    detected: ['audio/mpeg'],
  },
  '.m4a': {
    mimeType: 'audio/mp4',
    kind: RecordingKind.audio,
    detected: ['audio/x-m4a', 'audio/mp4', 'video/mp4'],
  },
  '.wav': {
    mimeType: 'audio/wav',
    kind: RecordingKind.audio,
    detected: ['audio/wav'],
  },
};

const formatFor = (fileName: string) =>
  Object.hasOwn(FORMATS, extname(fileName).toLowerCase())
    ? FORMATS[extname(fileName).toLowerCase()]
    : undefined;

// Cheap check on the name alone, so an unsupported file is rejected before its
// body is written to disk.
export const hasAllowedExtension = (fileName: string): boolean =>
  formatFor(fileName) !== undefined;

// Reads the first bytes of the stored file. Returns undefined when the
// extension isn't allowed or the content doesn't match it. The client's
// Content-Type is never used.
export async function detectRecordingFormat(
  path: string,
  originalName: string,
): Promise<RecordingFormat | undefined> {
  const format = formatFor(originalName);
  if (!format) {
    return undefined;
  }
  const detected = await fileTypeFromFile(path);
  if (!detected || !format.detected.includes(detected.mime)) {
    return undefined;
  }
  return { mimeType: format.mimeType, kind: format.kind };
}

const MAX_NAME_LENGTH = 255;

// The client's file name is untrusted: it is only stored as metadata (and
// later sent back in Content-Disposition), never used as a path.
export function sanitizeFileName(name: string): string {
  const clean = basename(name.replace(/\\/g, '/'))
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (clean.length <= MAX_NAME_LENGTH) {
    return clean;
  }
  // Cut by code points, so a surrogate pair (e.g. an emoji) is never split.
  const ext = extname(clean);
  const stem = [...clean.slice(0, clean.length - ext.length)];
  let cut = '';
  for (const char of stem) {
    if (cut.length + char.length + ext.length > MAX_NAME_LENGTH) {
      break;
    }
    cut += char;
  }
  return cut + ext;
}
