import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  it.each([
    [500, '500 bytes'],
    [32 * 1024, '32 KB'],
    [1.5 * 1024 ** 2, '1.5 MB'],
    [5 * 1024 ** 2, '5 MB'],
    [2 * 1024 ** 3, '2 GB'],
  ])('formatBytes(%d) is %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
