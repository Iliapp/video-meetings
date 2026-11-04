# api (NestJS)

NestJS 12 (Express), listens on `PORT` (default `4000`). PostgreSQL via Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`).

## Environment

Copy `.env.example` to `.env`. `JWT_SECRET` is required; `DATABASE_URL`, `JWT_EXPIRES_IN`, `WEB_ORIGIN` (comma-separated CORS origins), `RECORDINGS_DIR`/`AVATARS_DIR`, `RECORDINGS_MAX_BYTES`/`AVATAR_MAX_BYTES`, `RECORDING_URL_TTL` (`90`, `15m`, `6h`, …) have defaults in `.env.example`. Invalid limits, TTL or `API_PUBLIC_URL` stop the app from starting.

- `RECORDINGS_DIR`/`AVATARS_DIR`: persistent, backed-up volume; one api instance per directory.
- `API_PUBLIC_URL`: public base for signed recording URLs and `avatarUrl`. Unset → the request's protocol and `Host`, so **set it whenever the api runs behind a proxy or TLS terminator**.
- `main.ts` raises `requestTimeout` to 2 h for large uploads; a reverse proxy needs matching body size limit and timeouts.

## Commands (in `apps/api`, or `pnpm --filter api <script>`)

`dev`, `build` (`prisma generate` + `nest build`), `start:prod`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:deploy`, `db:studio`.

- `pnpm db:migrate` doesn't regenerate the client: run `pnpm exec prisma generate` afterwards.
- Jest runs through `node --experimental-vm-modules`; use the scripts, not `jest` directly. Single file: `pnpm test -- <pattern>` (same for `test:e2e`).
- Jest doesn't type-check the whole project, so also run `lint`, `typecheck` and `build`.

## Testing

- Unit specs beside the code (`*.spec.ts`), dependencies mocked through `Test.createTestingModule` providers.
- E2E (`test/*.e2e-spec.ts`) boots the full `AppModule` over supertest and needs `pnpm db:up`. `test/setup-env.ts` sets the test database (`video_meetings_test`, or `TEST_DATABASE_URL`), `JWT_SECRET`, temp storage dirs and small size limits, so no `.env` is needed; `test/global-setup.ts` applies migrations. E2E doesn't run `main.ts`, so global pipes etc. go in `AppModule` (`APP_PIPE`).
- A test that checks absolute URLs (`avatarUrl`) must listen on a real port, because the base comes from the request's `Host`. To test URL expiry, restart the app with a short `RECORDING_URL_TTL` (see `recording-playback.e2e-spec.ts`).
- Fixtures in `test/fixtures/` are shared with the web e2e tests.

## Structure

- `src/app.module.ts`: root module (global `ConfigModule`, `CqrsModule`, `ValidationPipe`, `@nestjs/observe`). Its `appKey`/`appSecret` are placeholders; move them to env vars before using real credentials.
- `src/prisma/`: global `PrismaService`. Generated client in `src/generated/prisma/` (gitignored), import from `../generated/prisma/client`.
- `src/common/`: provider-free helpers (`CloseConnectionOnErrorFilter`, `formatBytes`, `parsePublicUrl`).
- `src/auth/`: register, login, change password, JWT (scrypt hashes). Exports `JwtAuthGuard` + `@CurrentUser()`. Emails are trimmed and lowercased; unknown email and wrong password return the same `401`. A wrong current password is `400` with `field: 'currentPassword'`, not `401` (the web treats `401` as a lost session). Issued tokens stay valid after a password change.
- `src/users/`: user records and the `users/me` profile (name, avatar). Other modules use it only via the bus (`CreateUserCommand`, `FindUserBy*Query`, `UpdatePasswordCommand`). `GET /avatars/:key` is public; the key is a new random UUID per upload.
- `src/meetings/`: meetings the caller owns or is invited to (`meeting-access.ts`); not visible → `404`.
- `src/recordings/`: upload, list, delete (owner only, `MeetingOwnerGuard`, runs before the body is read) and stream/download through signed URLs (`RecordingUrlSigner`, HMAC key derived from `JWT_SECRET` via HKDF, so URL and access tokens are never interchangeable). Tokens are in query strings: never log full URLs. Any invalid token → `404`, never a hint why. `<video src>` and downloads aren't CORS requests. Before changing recordings, read `docs/research-meeting-upload.md` (the code wins where they differ).
- Uploads (recordings and avatars) share one pipeline: `CloseConnectionOnErrorFilter`, early `413` interceptor, multer to `<dir>/incoming`, magic-byte check with `file-type` (client `Content-Type` ignored), commit by rename via the `storage/` service (UUID keys only; `incoming/` is emptied on startup), compare-and-set on the row (`409` on a concurrent change). The temp file is deleted on any error; a failed removal of an old file is only logged.
- Files are served with the stored MIME type, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.
- `prisma/schema.prisma`, `prisma/migrations/` (committed), `prisma.config.ts`.

## Conventions

- TS `nodenext`, decorators + `emitDecoratorMetadata`, `strictPropertyInitialization` off. ESLint `recommendedTypeChecked`: `await` or `void` every promise.
- New features via the Nest CLI (`pnpm nest g module|controller|service <name>`), one module folder per feature under `src/`.
- Constructor injection with providers; keep controllers thin.
- CQRS: controllers only dispatch a command or query through the bus. Files in `commands/<name>/` or `queries/<name>/` as `<name>.command.ts`/`<name>.query.ts` (extends `Command<Result>`/`Query<Result>`) + `<name>.handler.ts`; register handlers in the module's `providers`.
- Modules talk through the buses, not each other's services. Only `AuthModule` is imported directly, for `JwtAuthGuard`.
- Response DTOs (`*-response.ts`) never expose password hashes or storage keys.
