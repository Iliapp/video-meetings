import { parsePublicUrl, parseUrlTtl } from './recordings.config';

describe('parseUrlTtl', () => {
  it('defaults to 6 hours', () => {
    expect(parseUrlTtl(undefined)).toBe(6 * 3600);
    expect(parseUrlTtl('')).toBe(6 * 3600);
  });

  it.each([
    ['90', 90],
    ['30s', 30],
    ['15m', 900],
    ['6h', 21600],
    ['1d', 86400],
    [' 2h ', 7200],
  ])('parses "%s" as %i seconds', (value, seconds) => {
    expect(parseUrlTtl(value)).toBe(seconds);
  });

  it.each(['0', '0s', '-1h', '1.5h', 'h', '6 hours', 'abc'])(
    'rejects "%s"',
    (value) => {
      expect(() => parseUrlTtl(value)).toThrow(/RECORDING_URL_TTL/);
    },
  );
});

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
