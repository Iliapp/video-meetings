import { join } from 'node:path';

// Ports differ from `pnpm dev` (3000/4000), so e2e can run next to it.
export const WEB_PORT = 3100;
export const API_PORT = 4100;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;

// The same limit for the api and the web pre-check, low enough to test the
// size error with a small file.
export const RECORDINGS_MAX_BYTES = 64 * 1024;

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/video_meetings_test';

// Gitignored; the api empties its incoming/ folder on start.
export const RECORDINGS_DIR = join(__dirname, '..', '.e2e', 'recordings');

// Media fixtures shared with the api e2e tests.
export const FIXTURES_DIR = join(
  __dirname,
  '..',
  '..',
  'api',
  'test',
  'fixtures',
);
