import { parsePublicUrl } from './public-url';

describe('parsePublicUrl', () => {
  it('is undefined when unset', () => {
    expect(parsePublicUrl(undefined)).toBeUndefined();
    expect(parsePublicUrl('')).toBeUndefined();
  });

  it.each([
    ['https://api.example.com', 'https://api.example.com'],
    ['https://api.example.com/', 'https://api.example.com'],
    ['https://example.com/api/', 'https://example.com/api'],
    ['http://localhost:4000', 'http://localhost:4000'],
  ])('normalizes "%s" to "%s"', (value, expected) => {
    expect(parsePublicUrl(value)).toBe(expected);
  });

  it.each(['api.example.com', 'ftp://example.com', 'https://x.com/?a=1'])(
    'rejects "%s"',
    (value) => {
      expect(() => parsePublicUrl(value)).toThrow(/API_PUBLIC_URL/);
    },
  );
});
