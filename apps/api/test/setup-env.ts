// e2e tests run against a separate database so they never touch dev data.
// DATABASE_URL is ignored on purpose; set TEST_DATABASE_URL to use another one.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/video_meetings_test';
process.env.JWT_SECRET ??= 'e2e-test-secret';
