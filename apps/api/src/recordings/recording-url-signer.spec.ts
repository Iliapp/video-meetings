import { ConfigService } from '@nestjs/config';
import { RecordingUrlSigner } from './recording-url-signer';
import type { RecordingsConfig } from './recordings.config';

describe('RecordingUrlSigner', () => {
  const recordingId = '3f9c2a52-4a49-4f0e-9e43-2b8f6f6d2c11';
  const now = Date.UTC(2026, 9, 18, 12, 0, 0);
  const config = { urlTtlSeconds: 3600 } as RecordingsConfig;
  const signerWith = (secret: string) =>
    new RecordingUrlSigner(new ConfigService({ JWT_SECRET: secret }), config);
  const signer = signerWith('secret');

  it('signs a token that verifies for the same recording and purpose', () => {
    const { token, expiresAt } = signer.sign(recordingId, 'stream', now);

    expect(expiresAt).toEqual(new Date(now + 3600 * 1000));
    expect(signer.verify(token, recordingId, 'stream', now)).toBe(true);
  });

  it('rejects the token once it has expired', () => {
    const { token, expiresAt } = signer.sign(recordingId, 'stream', now);

    expect(
      signer.verify(token, recordingId, 'stream', expiresAt.getTime() - 1),
    ).toBe(true);
    expect(
      signer.verify(token, recordingId, 'stream', expiresAt.getTime()),
    ).toBe(false);
  });

  it('rejects the token for another purpose or recording', () => {
    const { token } = signer.sign(recordingId, 'stream', now);

    expect(signer.verify(token, recordingId, 'download', now)).toBe(false);
    expect(
      signer.verify(
        token,
        '00000000-0000-4000-8000-000000000000',
        'stream',
        now,
      ),
    ).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    const { token } = signerWith('other').sign(recordingId, 'stream', now);

    expect(signer.verify(token, recordingId, 'stream', now)).toBe(false);
  });

  it('rejects a token with a changed payload or signature', () => {
    const { token } = signer.sign(recordingId, 'stream', now);
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(
      `${recordingId}.stream.${Math.floor(now / 1000) + 10 ** 9}`,
    ).toString('base64url');
    // Also changes the unused low bits of the last base64url character.
    const lastChar = signature.at(-1) === 'A' ? 'B' : 'A';

    expect(
      signer.verify(`${forged}.${signature}`, recordingId, 'stream', now),
    ).toBe(false);
    expect(
      signer.verify(
        `${payload}.${signature.slice(0, -1)}${lastChar}`,
        recordingId,
        'stream',
        now,
      ),
    ).toBe(false);
  });

  it.each(['', 'garbage', 'a.b', 'a.b.c', '.'])(
    'rejects the malformed token "%s"',
    (token) => {
      expect(signer.verify(token, recordingId, 'stream', now)).toBe(false);
    },
  );
});
