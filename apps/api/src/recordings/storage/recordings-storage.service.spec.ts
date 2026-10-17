import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecordingsStorageService } from './recordings-storage.service';

// Works on a real temp directory: the service is only file-system calls.
describe('RecordingsStorageService', () => {
  let dir: string;
  let storage: RecordingsStorageService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'recordings-storage-'));
    storage = new RecordingsStorageService({ dir, maxBytes: 1024 });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates incoming/ on startup', async () => {
    await storage.onModuleInit();

    expect(existsSync(storage.incomingDir)).toBe(true);
    expect(storage.incomingDir).toBe(join(dir, 'incoming'));
  });

  it('empties incoming/ on startup and keeps saved recordings', async () => {
    const saved = randomUUID();
    mkdirSync(storage.incomingDir);
    writeFileSync(join(storage.incomingDir, 'interrupted'), 'partial');
    writeFileSync(join(dir, saved), 'saved');

    await storage.onModuleInit();

    expect(readdirSync(storage.incomingDir)).toEqual([]);
    expect(readFileSync(join(dir, saved), 'utf8')).toBe('saved');
  });

  it('commits a temp file under a new UUID key', async () => {
    await storage.onModuleInit();
    const temp = join(storage.incomingDir, 'temp');
    writeFileSync(temp, 'bytes');

    const key = await storage.commit(temp);

    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(existsSync(temp)).toBe(false);
    expect(readFileSync(storage.pathFor(key), 'utf8')).toBe('bytes');
  });

  it('only accepts UUID keys, so a key cannot leave the directory', () => {
    const key = randomUUID();

    expect(storage.pathFor(key)).toBe(join(dir, key));
    expect(() => storage.pathFor('../etc/passwd')).toThrow(
      'Invalid storage key',
    );
  });

  it('removes a saved file and ignores one that is already gone', async () => {
    const key = randomUUID();
    writeFileSync(join(dir, key), 'bytes');

    await storage.remove(key);
    await expect(storage.remove(key)).resolves.toBeUndefined();

    expect(existsSync(join(dir, key))).toBe(false);
  });

  it('discards a temp file and ignores one that is already gone', async () => {
    await storage.onModuleInit();
    const temp = join(storage.incomingDir, 'temp');
    writeFileSync(temp, 'bytes');

    await storage.discard(temp);
    await expect(storage.discard(temp)).resolves.toBeUndefined();

    expect(existsSync(temp)).toBe(false);
  });
});
