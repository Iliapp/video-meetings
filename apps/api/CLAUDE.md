# api (NestJS)

NestJS 12 backend for video meetings. Express platform, listens on `PORT` (default `4000`). PostgreSQL via Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`).

## Environment

Copy `.env.example` to `.env` (loaded by `@nestjs/config` and `prisma.config.ts`):

- `DATABASE_URL`: Postgres connection string (root `pnpm db:up` starts it).
- `JWT_SECRET`: required, signs access tokens.
- `JWT_EXPIRES_IN`: token lifetime, default `1h`.
- `WEB_ORIGIN`: comma-separated origins allowed by CORS, default `http://localhost:3000`.
- `RECORDINGS_DIR`: where uploaded recordings are stored, default `recordings` (relative to the api's working directory, gitignored). Keep it on a persistent, backed-up volume; one api instance per directory.
- `RECORDINGS_MAX_BYTES`: upload size limit in bytes, default `2147483648` (2 GB). Must be a positive integer, or the app won't start.
- `AVATARS_DIR`: where uploaded avatars are stored, default `avatars` (relative to the api's working directory, gitignored). Persistent volume, one api instance per directory, as for recordings.
- `AVATAR_MAX_BYTES`: avatar size limit in bytes, default `5242880` (5 MB). Must be a positive integer, or the app won't start.
- `RECORDING_URL_TTL`: lifetime of signed stream/download URLs, default `6h`. Seconds (`90`) or `30s`/`15m`/`6h`/`1d`; anything else stops the app from starting.
- `API_PUBLIC_URL`: public base of the api used in signed recording URLs and `avatarUrl` (e.g. `https://api.example.com`, a path prefix is kept; must be http(s), or the app won't start). Unset → the protocol and `Host` of the request that asks for them, which is only right when browsers reach the api directly. **Set it whenever the api runs behind a proxy or TLS terminator**, or the URLs come out as the proxy's `http://` upstream.

## Commands (run in `apps/api`, or `pnpm --filter api <script>` from root)

- `pnpm dev`: start with watch mode (`nest start --watch`)
- `pnpm build`: `prisma generate` + compile to `dist/` via `nest build`
- `pnpm start:prod`: run `dist/main`
- `pnpm lint`: ESLint over `src` and `test`
- `pnpm typecheck`: `tsc --noEmit` over the whole project
- `pnpm test`: unit tests (Jest, `*.spec.ts` next to sources)
- `pnpm test:e2e`: e2e tests in `test/` (config `test/jest-e2e.json`); needs Postgres, see Testing
- `pnpm db:migrate`: create and apply a migration after editing `prisma/schema.prisma` (`prisma migrate dev`); it doesn't regenerate the client, so run `pnpm exec prisma generate` afterwards
- `pnpm db:deploy`: apply pending migrations (`prisma migrate deploy`)
- `pnpm db:studio`: open Prisma Studio
- `pnpm exec prisma generate`: regenerate the client (also runs on `postinstall` and `build`)

Jest runs through `node --experimental-vm-modules`; call the scripts instead of invoking `jest` directly.

## Testing

Run both suites from `apps/api` (or `pnpm --filter api test` / `pnpm --filter api test:e2e` from root):

1. `pnpm db:up` (from root): e2e needs Postgres on `localhost:5432`. Unit tests don't.
2. `pnpm test`: unit specs (`src/**/*.spec.ts`), with Prisma, buses and services mocked through `Test.createTestingModule` providers.
3. `pnpm test:e2e`: boots the full `AppModule` and calls it over HTTP with supertest. `test/setup-env.ts` points `DATABASE_URL` at `video_meetings_test` (or `TEST_DATABASE_URL`), defaults `JWT_SECRET`, gives each test file a temp `RECORDINGS_DIR` and `AVATARS_DIR` and lowers `RECORDINGS_MAX_BYTES` to 32 KB and `AVATAR_MAX_BYTES` to 16 KB, so no `.env` is needed. `recording-playback.e2e-spec.ts` restarts the app with `RECORDING_URL_TTL=2s` to test expiry. `avatar.e2e-spec.ts` listens on a real port, because `avatarUrl` is built from the request's `Host`. Small fixtures live in `test/fixtures/`: media made with ffmpeg (`no-duration.webm` has no duration, like a `MediaRecorder` file) and 16×16 `avatar.jpg|png|webp|gif` made with sharp (GIF is the unsupported format). `test/global-setup.ts` runs `prisma migrate deploy` first.

Run a single file with `pnpm test -- <path or pattern>` (same for `test:e2e`). Also run `pnpm lint`, `pnpm typecheck` and `pnpm build`; Jest doesn't type-check the whole project.

## Structure

- `src/main.ts`: bootstrap, attaches `ObserveInstrument`, enables CORS for `WEB_ORIGIN`, raises the HTTP server's `requestTimeout` to 2 h so large uploads aren't cut off (e2e tests don't run `main.ts`). A reverse proxy in front needs a matching body size limit and timeouts.
- `src/app.module.ts`: root module; registers global `ConfigModule`, `CqrsModule.forRoot()`, the global `ValidationPipe` (via `APP_PIPE`, so e2e tests get it too), and `@nestjs/observe` (`ObserveModule.forRoot`) for tracing/metrics. `appKey`/`appSecret` are still placeholders; move them to env vars before using real credentials, and never hardcode secrets.
- `src/prisma/`: global `PrismaModule` exporting `PrismaService` (extends `PrismaClient`).
- `src/common/`: helpers shared by feature modules, no providers: `CloseConnectionOnErrorFilter` (upload routes), `formatBytes` and `parsePublicUrl` (`API_PUBLIC_URL`).
- `src/users/`: CQRS, owns user records (`User.name` is an optional display name, `User.avatarKey`/`avatarMimeType` the optional avatar file's storage key and MIME type, set and cleared together). `UsersModule` imports `AuthModule` for the guard and exports nothing; it is imported only by `AppModule`.
  - For other modules (bus only): `CreateUserCommand` (`commands/create-user/`; duplicate email → `409`), `FindUserByEmailQuery` (`queries/find-user-by-email/`), `FindUserByIdQuery` (`queries/find-user-by-id/`) and `UpdatePasswordCommand` (`commands/update-password/`: replaces the hash only while the stored one is still the expected hash, else `409`).
  - `ProfileController` (`profile.controller.ts`): routes under `users/me` behind `JwtAuthGuard`, acting only on `@CurrentUser()` (no user id in the URL, so nobody reaches another user's profile). No or invalid token → `401`; a token for a user that no longer exists → `404 User not found`.
  - `GET /users/me` (`GetProfileQuery`, `queries/get-profile/`) → `ProfileResponse`.
  - `PATCH /users/me` (`200`, `UpdateProfileCommand`, `commands/update-profile/`): body `{ name? }` (`UpdateProfileDto` in `dto/`). `name` is trimmed, then 1–100 characters sets it, `null` clears it, omitted keeps it; blank, empty, too long or not a string → `400` and the stored name is unchanged. Returns the updated `ProfileResponse`.
  - `PUT /users/me/avatar` (`200`, `UploadAvatarCommand`, `commands/upload-avatar/`): multipart `file`, returns the updated `ProfileResponse`. Same pipeline as recording upload: `CloseConnectionOnErrorFilter`, `AvatarUploadInterceptor` (early `413` on `Content-Length`, "File is larger than …", temp file deleted on any error), multer (`MulterModule` in `users.module.ts`) to `AVATARS_DIR/incoming`, unknown extension → `415`, no file → `400`. The handler checks magic bytes with `file-type` (`avatar-file.ts`: JPG, PNG, WebP; the extension sets the stored `avatarMimeType`, the client's `Content-Type` is ignored), commits the file, then updates the row only if `avatarKey` is still the one it read, and deletes whichever file lost (the previous one on success, the new one on failure). A concurrent change → `409`.
  - `DELETE /users/me/avatar` (`204`, `DeleteAvatarCommand`, `commands/delete-avatar/`): clears `avatarKey`/`avatarMimeType` (same compare-and-set, `409` on a concurrent change), then deletes the file; a failed removal is only logged. No avatar → `204` too.
  - `ProfileResponse` (`profile-response.ts`): `id, email, name, avatarUrl`; the password hash and avatar key stay internal. `avatarUrl` is `null` without an avatar, else the absolute `<API_PUBLIC_URL or the request's protocol and Host>/avatars/<avatarKey>`: handlers return the path, `ProfileController` makes it absolute (`withAvatarBaseUrl`).
  - `GET /avatars/:key` (`AvatarFilesController`, `ResolveAvatarQuery` in `queries/resolve-avatar/`): public, so `<img src>` works without a `Bearer` header; the key is a random UUID that changes with every upload, so the URL is unguessable and an old one (replaced or removed avatar), an unknown or non-UUID key → `404 Avatar not found`. Sent with `res.sendFile`, the stored MIME type, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.
  - `storage/`: `AvatarStorageService`, the same layout as `RecordingsStorageService` under `AVATARS_DIR` (`incoming/<uuid>`, then `<uuid>`; a new key on every commit). `AvatarStorageModule` also provides `avatarsConfig` (`avatars.config.ts`: dir, size limit, public URL).
- `src/auth/`: CQRS (`@nestjs/cqrs`), credentials and tokens only. `POST /auth/register` (`201`) dispatches `RegisterUserCommand` (`commands/register-user/`), which hashes the password and sends `CreateUserCommand`; `POST /auth/login` (`200`) dispatches `LoginQuery` (`queries/login/`), which looks the user up with `FindUserByEmailQuery`. Both take `{ email, password }` and return `{ accessToken }` (JWT with `sub`, `email`, issued by `TokenService`). Emails are trimmed and lowercased; passwords hashed with scrypt (`PasswordService`); bad credentials → `401` with the same body for unknown email and wrong password.
  - `POST /auth/change-password` (`204`, behind `JwtAuthGuard`): body `{ currentPassword, newPassword }` (`ChangePasswordDto`; `newPassword` min 8 as in `RegisterDto`, else `400`). `ChangePasswordCommand` (`commands/change-password/`) reads the user with `FindUserByIdQuery`, verifies the current password (wrong → `401 Current password is incorrect`; user gone → `404`), and stores the new hash with `UpdatePasswordCommand`. Issued tokens stay valid.
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

- TypeScript: `module`/`moduleResolution` = `nodenext`, strict, decorators + `emitDecoratorMetadata` enabled, `strictPropertyInitialization` off.
- ESLint uses `recommendedTypeChecked`; `no-floating-promises` is an error, so `await` or `void` every promise.
- Use constructor injection with providers; keep controllers thin and put logic in services.
- Feature modules use CQRS: controllers only build a command (state change) or query (read) and send it through `CommandBus`/`QueryBus`. Each lives in `commands/<name>/` or `queries/<name>/` as `<name>.command.ts`/`<name>.query.ts` (extends `Command<Result>`/`Query<Result>` for typed results) plus `<name>.handler.ts`; register handlers in the module's `providers`.
- Modules talk to each other through the buses, not by importing each other's services: dispatch the other module's command/query class (e.g. `auth` → `CreateUserCommand`). Only `AuthModule` is imported directly, for `JwtAuthGuard`.
- Put unit specs beside the code (`foo.service.spec.ts`) and e2e specs in `test/*.e2e-spec.ts`.
- Before changing recordings, read `docs/research-meeting-upload.md` (why each library and technique was chosen; the code above is the source of truth where they differ).
