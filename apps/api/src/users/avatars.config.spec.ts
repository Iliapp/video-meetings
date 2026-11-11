import { parseAvatarMaxBytes } from './avatars.config';

describe('parseAvatarMaxBytes', () => {
  it('defaults to 5 MB', () => {
    expect(parseAvatarMaxBytes(undefined)).toBe(5 * 1024 * 1024);
    expect(parseAvatarMaxBytes('')).toBe(5 * 1024 * 1024);
  });

  it('parses a positive integer', () => {
    expect(parseAvatarMaxBytes('16384')).toBe(16384);
  });

  it.each(['0', '-1', '1.5', 'abc', '5MB'])('rejects "%s"', (value) => {
    expect(() => parseAvatarMaxBytes(value)).toThrow(/AVATAR_MAX_BYTES/);
  });
});
