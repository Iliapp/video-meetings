import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { recordingsConfig, type RecordingsConfig } from './recordings.config';

export type RecordingUrlPurpose = 'stream' | 'download';

export interface SignedRecordingToken {
  token: string;
  expiresAt: Date;
}

// Tokens for the stream and download URLs, which <video>, <audio> and plain
// links open without an Authorization header:
//   base64url("<recordingId>.<purpose>.<exp unix seconds>") "." base64url(HMAC-SHA256)
// The key is derived from JWT_SECRET with HKDF, so a URL token is never a valid
// access token, and an access token is never a valid URL token.
@Injectable()
export class RecordingUrlSigner {
  private readonly key: Buffer;

  constructor(
    config: ConfigService,
    @Inject(recordingsConfig.KEY) private readonly recordings: RecordingsConfig,
  ) {
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        config.getOrThrow<string>('JWT_SECRET'),
        '',
        'recording-urls',
        32,
      ),
    );
  }

  sign(
    recordingId: string,
    purpose: RecordingUrlPurpose,
    now = Date.now(),
  ): SignedRecordingToken {
    // Rounded up, so a URL is valid for at least the whole TTL.
    const exp = Math.ceil(now / 1000) + this.recordings.urlTtlSeconds;
    const payload = Buffer.from(`${recordingId}.${purpose}.${exp}`).toString(
      'base64url',
    );
    return {
      token: `${payload}.${this.signature(payload)}`,
      expiresAt: new Date(exp * 1000),
    };
  }

  // True only for an untampered, unexpired token issued for this recording and
  // purpose.
  verify(
    token: string,
    recordingId: string,
    purpose: RecordingUrlPurpose,
    now = Date.now(),
  ): boolean {
    const [payload, signature, ...rest] = token.split('.');
    if (!payload || !signature || rest.length > 0) {
      return false;
    }
    // Compares the encoded strings, so a changed padding bit in the last
    // base64url character also fails.
    const expected = Buffer.from(this.signature(payload));
    const actual = Buffer.from(signature);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return false;
    }
    const [id, tokenPurpose, exp] = Buffer.from(payload, 'base64url')
      .toString()
      .split('.');
    return (
      id === recordingId && tokenPurpose === purpose && Number(exp) * 1000 > now
    );
  }

  private signature(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}
