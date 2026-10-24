import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectRecordingFormat,
  hasAllowedExtension,
  sanitizeFileName,
} from './recording-file';

const FIXTURES = join(__dirname, '..', '..', 'test', 'fixtures');

describe('recording-file', () => {
  describe('detectRecordingFormat', () => {
    let dir: string;

    // Copies a fixture under an extension-less name, as multer stores uploads.
    const stored = (fixture: string) => {
      const path = join(dir, 'upload');
      copyFileSync(join(FIXTURES, fixture), path);
      return path;
    };

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'recording-file-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it.each([
      ['sample.mp4', 'call.mp4', 'video/mp4', 'video'],
      ['sample.webm', 'call.WEBM', 'video/webm', 'video'],
      ['no-duration.webm', 'call.webm', 'video/webm', 'video'],
      ['sample.mp3', 'call.mp3', 'audio/mpeg', 'audio'],
      ['sample.m4a', 'call.m4a', 'audio/mp4', 'audio'],
      ['sample.mp4', 'call.m4a', 'audio/mp4', 'audio'],
      ['sample.wav', 'call.wav', 'audio/wav', 'audio'],
    ])('maps %s named %s to %s (%s)', async (fixture, name, mimeType, kind) => {
      await expect(
        detectRecordingFormat(stored(fixture), name),
      ).resolves.toEqual({ mimeType, kind });
    });

    it.each([
      ['sample.wav', 'call.mp4'],
      ['sample.mp3', 'call.webm'],
      ['sample.mp4', 'call.mp3'],
      ['sample.mp3', 'call.ogg'],
    ])('rejects %s named %s', async (fixture, name) => {
      await expect(
        detectRecordingFormat(stored(fixture), name),
      ).resolves.toBeUndefined();
    });

    it('rejects content without known magic bytes', async () => {
      const path = join(dir, 'upload');
      writeFileSync(path, 'plain text pretending to be audio');

      await expect(
        detectRecordingFormat(path, 'call.mp3'),
      ).resolves.toBeUndefined();
    });
  });

  it.each([
    ['a.mp4', true],
    ['a.M4A', true],
    ['a.wav', true],
    ['a.mov', false],
    ['mp3', false],
    ['a.toString', false],
  ])('hasAllowedExtension(%s) is %s', (name, allowed) => {
    expect(hasAllowedExtension(name)).toBe(allowed);
  });

  describe('sanitizeFileName', () => {
    it('keeps a normal non-ASCII name', () => {
      expect(sanitizeFileName('Зустріч команди.mp3')).toBe(
        'Зустріч команди.mp3',
      );
    });

    it('drops directories, including Windows ones', () => {
      expect(sanitizeFileName('../../etc/a.mp3')).toBe('a.mp3');
      expect(sanitizeFileName('C:\\Users\\me\\a.mp3')).toBe('a.mp3');
    });

    it('strips control characters and normalizes to NFC', () => {
      expect(sanitizeFileName('a\r\nb\u0000.mp3')).toBe('ab.mp3');
      expect(sanitizeFileName('e\u0301.mp3')).toBe('\u00e9.mp3');
    });

    it('caps the length at 255 and keeps the extension', () => {
      const name = sanitizeFileName(`${'x'.repeat(300)}.webm`);

      expect(name).toHaveLength(255);
      expect(name.endsWith('.webm')).toBe(true);
    });

    it('never splits a surrogate pair when it cuts', () => {
      const name = sanitizeFileName(`${'a'.repeat(250)}😀😀.mp4`);

      expect(name).toBe(`${'a'.repeat(250)}.mp4`);
    });
  });
});
