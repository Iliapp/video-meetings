import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Optional so `prisma generate` (postinstall, build) works without a .env;
    // migrate commands still fail clearly when it is missing.
    url: process.env.DATABASE_URL,
  },
});
