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

- `src/main.ts`: bootstrap, attaches `ObserveInstrument`, enables CORS for `WEB_ORIGIN`, raises the HTTP server's `requestTimeout` to 2 h so large uploads aren't cut off (e2e tests don't run `main.ts`). A reverse proxy in front needs a matching body size limit and timeouts.
- `src/app.module.ts`: root module; registers global `ConfigModule`, `CqrsModule.forRoot()`, the global `ValidationPipe` (via `APP_PIPE`, so e2e tests get it too), and `@nestjs/observe` (`ObserveModule.forRoot`) for tracing/metrics. `appKey`/`appSecret` are still placeholders; move them to env vars before using real credentials, and never hardcode secrets.
- `src/prisma/`: global `PrismaModule` exporting `PrismaService` (extends `PrismaClient`).
- `src/users/`: CQRS, owns user records (`email`, `passwordHash`, optional `name`). `CreateUserCommand` (`commands/create-user/`; duplicate email → `409`) and `FindUserByEmailQuery` (`queries/find-user-by-email/`) serve other modules over the bus. `UsersModule` exports nothing; it is imported only by `AppModule` to register its handlers and controller.
  - `ProfileController` (`users/me`, behind `JwtAuthGuard`, acts only on `@CurrentUser()`; there is no user id in the URL): `GET` (`GetProfileQuery`) and `PATCH` (`UpdateProfileCommand`) both return `Profile` (`profile.ts`: `id, email, name, avatarUrl`; `avatarUrl` is always `null` for now, the password hash is never selected). `PATCH` takes `{ name }` (`UpdateProfileDto`): trimmed, 1–100 characters, or `null` to clear it; blank, too long, non-string or missing → `400`. A user deleted after the token was issued → `404 User not found`.
- `src/auth/`: CQRS (`@nestjs/cqrs`), credentials and tokens only. `POST /auth/register` (`201`) dispatches `RegisterUserCommand` (`commands/register-user/`), which hashes the password and sends `CreateUserCommand`; `POST /auth/login` (`200`) dispatches `LoginQuery` (`queries/login/`), which looks the user up with `FindUserByEmailQuery`. Both take `{ email, password }` and return `{ accessToken }` (JWT with `sub`, `email`, issued by `TokenService`). Emails are trimmed and lowercased; passwords hashed with scrypt (`PasswordService`); bad credentials → `401` with the same body for unknown email and wrong password.
  - `JwtAuthGuard` protects routes: verifies `Authorization: Bearer <jwt>` (else `401`) and sets `request.user`; read it with `@CurrentUser()` (`AuthUser` = `{ id, email }`). `AuthModule` exports the guard and `JwtModule`, so import `AuthModule` to use it.
- `src/meetings/`: CQRS, all routes behind `JwtAuthGuard`. `POST /meetings` (`201`, `CreateMeetingCommand`) takes `{ title, date (ISO 8601), participants: email[] }` and makes the caller the owner. `GET /meetings` (`ListMeetingsQuery`) lists meetings the caller owns or is invited to (`meeting-access.ts`), sorted by date. `GET /meetings/:id` (`GetMeetingQuery`) returns one; unknown, non-UUID or not-visible ids → `404 Meeting not found`.
- `src/recordings/`: CQRS. `RecordingsController`: routes under `meetings/:id/recordings` behind `JwtAuthGuard`. `RecordingFilesController`: `recordings/:recordingId/stream|download`, authorized by a signed URL token instead.
  - `POST` (`201`, `UploadRecordingCommand`): multipart `file` plus optional `durationSeconds` (finite, ≥ 0, else `400`, blank included; omitted → `null`). `MeetingOwnerGuard` runs before the body is read: not visible → `404`, invited but not owner → `403 Only the meeting owner can change recordings`. `CloseConnectionOnErrorFilter` sends `Connection: close` when the request is rejected before its body was read, so Node doesn't drain it. `RecordingUploadInterceptor` rejects a too-large `Content-Length`, renames multer's `413` to "File is larger than …", and deletes the temp file on any error. multer (`MulterModule` in `recordings.module.ts`) streams to `RECORDINGS_DIR/incoming`, decodes file names as UTF-8 and rejects unknown extensions with `415`. The handler checks magic bytes with `file-type` (`recording-file.ts`: allow-list MP4, WebM, MP3, M4A, WAV; the extension sets the stored MIME type and `kind`, the client's `Content-Type` is ignored), commits the file, then creates the row (a meeting deleted mid-upload → `404`, and the file is removed).
  - `GET` (`ListRecordingsQuery`): owner and invited participants (access via `GetMeetingQuery` on the bus, else `404`), newest first.
  - `GET :recordingId/urls` (`GetRecordingUrlsQuery`): owner and invited → `{ streamUrl, downloadUrl, expiresAt }`, absolute URLs with a `token` query param. Not visible → `404 Meeting not found`; unknown, non-UUID or another meeting's recording → `404 Recording not found`.
  - `DELETE :recordingId` (`204`, `DeleteRecordingCommand`): owner only (`MeetingOwnerGuard`, as for upload). Deletes the row, then the file; a failed file removal is only logged. Unknown recording → `404 Recording not found`.
  - `GET /recordings/:recordingId/stream?token=` and `/download?token=` (`ResolveSignedRecordingQuery`): the token is checked before the file is touched, so a missing, expired, tampered, wrong-purpose or deleted recording's token → `404 Recording not found`, Range requests included. Sent with Express `res.sendFile` / `res.download` (Range → `206`, `416`, ETag), the stored MIME type, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`; download adds `Content-Disposition: attachment` with `filename*` for non-ASCII names. No CORS needed: `<video src>` and link navigation aren't CORS requests.
  - `RecordingUrlSigner` (`recording-url-signer.ts`): token = base64url(`<recordingId>.<stream|download>.<exp>`) + `.` + HMAC-SHA256, key derived from `JWT_SECRET` with HKDF (`recording-urls`), so URL and access tokens are never interchangeable. Tokens in query strings end up in access logs; don't log full URLs.
  - Responses are `RecordingResponse` (`recording-response.ts`): `id, meetingId, originalName, mimeType, kind, sizeBytes, durationSeconds, createdAt, uploaderEmail`; the storage key stays internal.
  - `storage/`: `RecordingsStorageService` owns the file layout (`incoming/<uuid>` while uploading, `<uuid>` once committed by rename; `pathFor` accepts only UUID keys) and empties `incoming/` on startup. `RecordingsStorageModule` also provides `recordingsConfig` (`recordings.config.ts`: dir, size limit, URL TTL, public URL).
- `src/generated/prisma/`: generated Prisma client (gitignored, don't edit). Import from `../generated/prisma/client`.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma.config.ts`: schema, migrations (committed), CLI config.
- Generate new features with the Nest CLI (`pnpm nest g module|controller|service <name>`) so each feature gets its own module folder under `src/`.

## Conventions

- TS `nodenext`, decorators + `emitDecoratorMetadata`, `strictPropertyInitialization` off. ESLint `recommendedTypeChecked`: `await` or `void` every promise.
- New features via the Nest CLI (`pnpm nest g module|controller|service <name>`), one module folder per feature under `src/`.
- Constructor injection with providers; keep controllers thin.
- CQRS: controllers only dispatch a command or query through the bus. Files in `commands/<name>/` or `queries/<name>/` as `<name>.command.ts`/`<name>.query.ts` (extends `Command<Result>`/`Query<Result>`) + `<name>.handler.ts`; register handlers in the module's `providers`.
- Modules talk through the buses, not each other's services. Only `AuthModule` is imported directly, for `JwtAuthGuard`.
- Response DTOs (`*-response.ts`) never expose password hashes or storage keys.
