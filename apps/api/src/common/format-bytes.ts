const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'];

// 32768 → "32 KB", 2147483648 → "2 GB".
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${Number(value.toFixed(1))} ${UNITS[unit]}`;
}
