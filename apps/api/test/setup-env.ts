// e2e tests run against a separate database so they never touch dev data.
// Values already in the environment win, so CI can point at its own database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/video_meetings_test';
process.env.JWT_SECRET ??= 'e2e-test-secret';
