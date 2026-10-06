# api (NestJS)

NestJS 12 backend for video meetings. Express platform, listens on `PORT` (default `4000`). PostgreSQL via Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`).

## Environment

Copy `.env.example` to `.env` (loaded by `@nestjs/config` and `prisma.config.ts`):

- `DATABASE_URL`: Postgres connection string (root `pnpm db:up` starts it).
- `JWT_SECRET`: required, signs access tokens.
- `JWT_EXPIRES_IN`: token lifetime, default `1h`.
- `WEB_ORIGIN`: comma-separated origins allowed by CORS, default `http://localhost:3000`.

## Commands (run in `apps/api`, or `pnpm --filter api <script>` from root)

- `pnpm dev`: start with watch mode (`nest start --watch`)
- `pnpm build`: `prisma generate` + compile to `dist/` via `nest build`
- `pnpm start:prod`: run `dist/main`
- `pnpm lint`: ESLint over `src` and `test`
- `pnpm test`: unit tests (Jest, `*.spec.ts` next to sources)
- `pnpm test:e2e`: e2e tests in `test/` (config `test/jest-e2e.json`, uses supertest). Needs Postgres running; runs against `video_meetings_test` (override with `TEST_DATABASE_URL`), which `test/global-setup.ts` creates and migrates with `prisma migrate deploy`.
- `pnpm db:migrate`: create and apply a migration after editing `prisma/schema.prisma` (`prisma migrate dev`); it doesn't regenerate the client, so run `pnpm exec prisma generate` afterwards
- `pnpm db:deploy`: apply pending migrations (`prisma migrate deploy`)
- `pnpm db:studio`: open Prisma Studio
- `pnpm exec prisma generate`: regenerate the client (also runs on `postinstall` and `build`)

Jest runs through `node --experimental-vm-modules`; call the scripts instead of invoking `jest` directly.

## Structure

- `src/main.ts`: bootstrap, attaches `ObserveInstrument`, enables CORS for `WEB_ORIGIN`.
- `src/app.module.ts`: root module; registers global `ConfigModule`, `CqrsModule.forRoot()`, the global `ValidationPipe` (via `APP_PIPE`, so e2e tests get it too), and `@nestjs/observe` (`ObserveModule.forRoot`) for tracing/metrics. `appKey`/`appSecret` are still placeholders; move them to env vars before using real credentials, and never hardcode secrets.
- `src/prisma/`: global `PrismaModule` exporting `PrismaService` (extends `PrismaClient`).
- `src/users/`: `UsersService` (find/create users; duplicate email → `409`).
- `src/auth/`: CQRS (`@nestjs/cqrs`). `POST /auth/register` (`201`) dispatches `RegisterUserCommand` (`commands/register-user/`); `POST /auth/login` (`200`) dispatches `LoginQuery` (`queries/login/`). Both take `{ email, password }` and return `{ accessToken }` (JWT with `sub`, `email`, issued by `TokenService`). Emails are trimmed and lowercased; passwords hashed with scrypt (`PasswordService`); bad credentials → `401` with the same body for unknown email and wrong password.
  - `JwtAuthGuard` protects routes: verifies `Authorization: Bearer <jwt>` (else `401`) and sets `request.user`; read it with `@CurrentUser()` (`AuthUser` = `{ id, email }`). `AuthModule` exports the guard and `JwtModule`, so import `AuthModule` to use it.
- `src/meetings/`: CQRS, all routes behind `JwtAuthGuard`. `POST /meetings` (`201`, `CreateMeetingCommand`) takes `{ title, date (ISO 8601), participants: email[] }` and makes the caller the owner. `GET /meetings` (`ListMeetingsQuery`) lists meetings the caller owns or is invited to (`meeting-access.ts`), sorted by date. `GET /meetings/:id` (`GetMeetingQuery`) returns one; unknown, non-UUID or not-visible ids → `404 Meeting not found`.
- `src/generated/prisma/`: generated Prisma client (gitignored, don't edit). Import from `../generated/prisma/client`.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma.config.ts`: schema, migrations (committed), CLI config.
- Generate new features with the Nest CLI (`pnpm nest g module|controller|service <name>`) so each feature gets its own module folder under `src/`.

## Conventions

- TypeScript: `module`/`moduleResolution` = `nodenext`, strict, decorators + `emitDecoratorMetadata` enabled, `strictPropertyInitialization` off.
- ESLint uses `recommendedTypeChecked`; `no-floating-promises` is an error, so `await` or `void` every promise.
- Use constructor injection with providers; keep controllers thin and put logic in services.
- Feature modules use CQRS: controllers only build a command (state change) or query (read) and send it through `CommandBus`/`QueryBus`. Each lives in `commands/<name>/` or `queries/<name>/` as `<name>.command.ts`/`<name>.query.ts` (extends `Command<Result>`/`Query<Result>` for typed results) plus `<name>.handler.ts`; register handlers in the module's `providers`.
- Put unit specs beside the code (`foo.service.spec.ts`) and e2e specs in `test/*.e2e-spec.ts`.
