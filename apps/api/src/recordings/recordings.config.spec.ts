import { parseUrlTtl } from './recordings.config';

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
