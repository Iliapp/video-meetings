import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// e2e tests run against a separate database so they never touch dev data.
// DATABASE_URL is ignored on purpose; set TEST_DATABASE_URL to use another one.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/video_meetings_test';
process.env.JWT_SECRET ??= 'e2e-test-secret';

// Each test file gets its own recordings and avatars directories, so parallel
// Jest workers never share files. The size limits are lowered so the 413 path
// can be tested with a small file.
process.env.RECORDINGS_DIR = mkdtempSync(join(tmpdir(), 'vm-recordings-'));
process.env.RECORDINGS_MAX_BYTES = String(32 * 1024);
process.env.AVATARS_DIR = mkdtempSync(join(tmpdir(), 'vm-avatars-'));
process.env.AVATAR_MAX_BYTES = String(16 * 1024);
