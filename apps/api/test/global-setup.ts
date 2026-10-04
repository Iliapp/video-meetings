import { execSync } from 'node:child_process';
import './setup-env';

// Brings the test database schema up to date before any suite runs.
export default function globalSetup() {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    env: process.env,
    stdio: 'inherit',
  });
}
