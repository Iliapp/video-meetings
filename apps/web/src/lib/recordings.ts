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
