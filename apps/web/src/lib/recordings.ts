const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'];

/** 4406 → "4.3 KB", 2147483648 → "2 GB" (1 KB = 1024 bytes, like the api). */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${Number(value.toFixed(1))} ${UNITS[unit]}`;
}

/** 12.5 → "0:13", 3725 → "1:02:05"; unknown → "—". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// Same allow-list and limit as the api, checked before an upload starts, so
// the user sees the real reason (a server rejection mid-upload often reaches
// the browser as a dropped connection).
const EXTENSIONS = ['.mp4', '.webm', '.mp3', '.m4a', '.wav'];

/** For the file picker: MIME types plus extensions, since some systems report
 * an empty or unusual MIME type for .m4a and .webm. */
export const ACCEPTED_FILE_TYPES = [
  'video/mp4',
  'video/webm',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  ...EXTENSIONS,
];

export const MAX_UPLOAD_BYTES =
  Number(process.env.NEXT_PUBLIC_RECORDINGS_MAX_BYTES) || 2 * 1024 ** 3;

export const UNSUPPORTED_FORMAT_MESSAGE =
  'Unsupported file format. Allowed: MP4, WebM, MP3, M4A, WAV';

export const FORMATS_HINT = `MP4, WebM, MP3, M4A or WAV, up to ${formatBytes(MAX_UPLOAD_BYTES)}`;

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

/** The reason a file can't be uploaded, or `null` when it can. */
export function validateRecordingFile(file: File): string | null {
  if (!EXTENSIONS.includes(extensionOf(file.name))) {
    return UNSUPPORTED_FORMAT_MESSAGE;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is larger than ${formatBytes(MAX_UPLOAD_BYTES)}`;
  }
  return null;
}

/**
 * Reads the duration from the file's metadata in an off-DOM media element.
 * Resolves `undefined` when it is unknown: WebM from MediaRecorder reports
 * `Infinity`, and some codecs can't be decoded by the browser.
 */
export function readMediaDuration(
  file: File,
  {
    signal,
    timeoutMs = 5000,
  }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<number | undefined> {
  return new Promise((resolve) => {
    const isAudio = ['.mp3', '.m4a', '.wav'].includes(extensionOf(file.name));
    const media = document.createElement(isAudio ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    const done = (duration?: number) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(url);
      resolve(
        duration !== undefined && Number.isFinite(duration) && duration >= 0
          ? duration
          : undefined,
      );
    };
    const timer = setTimeout(() => done(), timeoutMs);
    // Cancel shouldn't wait for slow metadata; the caller checks the signal.
    const onAbort = () => done();
    signal?.addEventListener('abort', onAbort, { once: true });
    media.preload = 'metadata';
    media.muted = true;
    media.onloadedmetadata = () => done(media.duration);
    media.onerror = () => done();
    media.src = url;
  });
}
