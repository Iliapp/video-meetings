import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectAvatarMimeType, hasAllowedAvatarExtension } from './avatar-file';

const FIXTURES = join(__dirname, '..', '..', 'test', 'fixtures');

describe('avatar-file', () => {
  describe('detectAvatarMimeType', () => {
    let dir: string;

    // Copies a fixture under an extension-less name, as multer stores uploads.
    const stored = (fixture: string) => {
      const path = join(dir, 'upload');
      copyFileSync(join(FIXTURES, fixture), path);
      return path;
    };

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'avatar-file-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it.each([
      ['avatar.jpg', 'me.jpg', 'image/jpeg'],
      ['avatar.jpg', 'me.JPEG', 'image/jpeg'],
      ['avatar.png', 'me.png', 'image/png'],
      ['avatar.webp', 'me.webp', 'image/webp'],
    ])('maps %s named %s to %s', async (fixture, name, mimeType) => {
      await expect(detectAvatarMimeType(stored(fixture), name)).resolves.toBe(
        mimeType,
      );
    });

    it.each([
      ['avatar.png', 'me.jpg'],
      ['avatar.jpg', 'me.webp'],
      ['avatar.gif', 'me.png'],
      ['avatar.gif', 'me.gif'],
    ])('rejects %s named %s', async (fixture, name) => {
      await expect(
        detectAvatarMimeType(stored(fixture), name),
      ).resolves.toBeUndefined();
    });

    it('rejects content without known magic bytes', async () => {
      const path = join(dir, 'upload');
      writeFileSync(path, 'plain text pretending to be an image');

      await expect(
        detectAvatarMimeType(path, 'me.png'),
      ).resolves.toBeUndefined();
    });
  });

  it.each([
    ['a.jpg', true],
    ['a.JPEG', true],
    ['a.png', true],
    ['a.webp', true],
    ['a.gif', false],
    ['a.svg', false],
    ['png', false],
    ['a.toString', false],
  ])('hasAllowedAvatarExtension(%s) is %s', (name, allowed) => {
    expect(hasAllowedAvatarExtension(name)).toBe(allowed);
  });
});
