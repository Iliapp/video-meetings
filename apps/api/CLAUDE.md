# api (NestJS)

NestJS 12 backend for video meetings. Express platform, listens on `PORT` (default `4000`).

## Commands (run in `apps/api`, or `pnpm --filter api <script>` from root)

- `pnpm dev`: start with watch mode (`nest start --watch`)
- `pnpm build`: compile to `dist/` via `nest build`
- `pnpm start:prod`: run `dist/main`
- `pnpm lint`: ESLint over `src` and `test`
- `pnpm test`: unit tests (Jest, `*.spec.ts` next to sources)
- `pnpm test:e2e`: e2e tests in `test/` (config `test/jest-e2e.json`, uses supertest)

Jest runs through `node --experimental-vm-modules`; call the scripts instead of invoking `jest` directly.

## Structure

- `src/main.ts`: bootstrap, attaches `ObserveInstrument`.
- `src/app.module.ts`: root module; registers `@nestjs/observe` (`ObserveModule.forRoot`) for tracing/metrics. `appKey`/`appSecret` are still placeholders; move them to env vars before using real credentials, and never hardcode secrets.
- Generate new features with the Nest CLI (`pnpm nest g module|controller|service <name>`) so each feature gets its own module folder under `src/`.

## Conventions

- TypeScript: `module`/`moduleResolution` = `nodenext`, strict, decorators + `emitDecoratorMetadata` enabled, `strictPropertyInitialization` off.
- ESLint uses `recommendedTypeChecked`; `no-floating-promises` is an error, so `await` or `void` every promise.
- Use constructor injection with providers; keep controllers thin and put logic in services.
- Put unit specs beside the code (`foo.service.spec.ts`) and e2e specs in `test/*.e2e-spec.ts`.
