import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Hashes are stored as `<salt hex>:<key hex>`.
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await scryptAsync(password, salt, KEY_LENGTH);
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const [saltHex, keyHex] = hash.split(':');
    if (!saltHex || !keyHex) {
      return false;
    }
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scryptAsync(
      password,
      Buffer.from(saltHex, 'hex'),
      expected.length,
    );
    return timingSafeEqual(actual, expected);
  }
}
