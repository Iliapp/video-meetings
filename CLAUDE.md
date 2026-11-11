# video-meetings

Monorepo: Next.js web client (`apps/web`) and NestJS API (`apps/api`). The browser calls the api directly over REST/JSON at `NEXT_PUBLIC_API_URL` (CORS via `WEB_ORIGIN`, `Bearer` JWT). Media the browser loads itself (`<video>`/`<audio>`, `<img>` avatars) uses absolute api URLs that need no `Bearer` header: signed for recordings, unguessable per upload for avatars.
Each app has its own `CLAUDE.md`; read it before working in that app.

## Tooling

- Node.js **24.9+** (`.nvmrc`), also for the system Node that Git GUIs use to run Husky hooks. Older Node fails with `ERR_PNPM_BAD_RUNTIME_VERSION` (NestJS 12 is ESM-only, Jest needs 24.9+).
- **pnpm only** (`pnpm@12.8.1` via `devEngines`); use `pnpm dlx`, not `npx`. Add a dependency with `pnpm --filter <web|api> add <pkg>`; install scripts run only for packages in `pnpm-workspace.yaml` `allowBuilds`.
- Prettier at the root; a `PostToolUse` hook (`.claude/hooks/format.mjs`) formats every file Claude writes.
- Husky `pre-commit` runs `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit only). E2E needs Postgres; run it manually. Emergency bypass: `git commit --no-verify`.
- `.mcp.json` registers the Playwright MCP server (`playwright`) for testing the running web app.

## Commands (from repo root)

| Command                              | What it does                                              |
| ------------------------------------ | --------------------------------------------------------- |
| `pnpm dev`                           | Run all apps in parallel (web on :3000, api on :4000)     |
| `pnpm dev:web` / `pnpm dev:api`      | Run a single app                                          |
| `pnpm build` / `lint` / `typecheck`  | For all apps                                              |
| `pnpm test`                          | Unit tests (api only; web has none)                       |
| `pnpm --filter <app> test:e2e`       | E2E: api (Jest + supertest), web (Playwright)             |
| `pnpm format` / `pnpm format:check`  | Prettier write / check                                    |
| `pnpm db:up` / `db:down` / `db:logs` | Local Postgres: start (waits until healthy) / stop / logs |

## Local database

`docker-compose.yml`: PostgreSQL 17 on `localhost:5432` (needs Docker Desktop), `postgresql://postgres:postgres@localhost:5432/video_meetings`; override with `POSTGRES_*` env vars. `docker compose down -v` wipes the data. E2E tests use a separate `video_meetings_test` database (created automatically); the web e2e run starts its own api on :4100 and web on :3100.

## Conventions

- TypeScript strict mode everywhere.
- Don't commit build output (`dist`, `.next*`, `*.tsbuildinfo`) or `.env*` files.
- Refactoring: run the affected app's unit and e2e tests before you start and after each step; don't continue from red. Report tests that fail beforehand instead of silently fixing them.
- Skills: third-party ones live in `.agents/skills/` (tracked in `skills-lock.json`, symlinked into `.claude/skills/`, install with `pnpm dlx skills add <source>`); project ones (`prd`, `plan-phase`, `issues`) are plain folders in `.claude/skills/`.

## Saving tokens

- Search, then read the part you need: `grep -rn "changePassword" apps/web/src`, then read with `offset`/`limit`, not whole folders. Don't re-read a file you just edited.
- Don't read generated or bulky files: `pnpm-lock.yaml`, `src/generated/prisma/` (read `prisma/schema.prisma`), `node_modules/` (except the Next guide `AGENTS.md` points to), `dist/`, `.next*/`, `test-results/`, `.e2e/`.
- Trim command output: `pnpm test 2>&1 | tail -30`, `pnpm --filter web test:e2e --reporter=line 2>&1 | tail -40`, `git diff --stat` before `git diff <file>`, `git log --oneline -10`, `gh issue view <n> --json title,body`.
- While iterating, run only the affected tests: `pnpm --filter api test -- profile`, `pnpm --filter api test:e2e -- avatar`, `pnpm --filter web test:e2e e2e/profile.spec.ts -g "avatar"`. Run the full suites once, before the commit.
- Playwright MCP: check states with `browser_snapshot`; take screenshots only at the widths the web Definition of done asks for, once the UI is final.
- Edit with small, exact replacements instead of rewriting whole files.

## Keeping docs in sync

Update the docs in the same change as an architecture change: a new/removed/renamed app, NestJS module or top-level folder; a framework, library, data, auth or realtime layer swap; how web and api communicate; env vars, scripts, ports, build or test setup.

- Repo-wide things go in this file, app-specific ones in `apps/<app>/CLAUDE.md`, skill changes in `skills-lock.json` plus a mention in the relevant `CLAUDE.md`. Don't edit `apps/web/AGENTS.md` (generated).
- Write only what the code doesn't make obvious: what exists and where, commands, rules and gotchas. One or two lines per module; no per-endpoint behavior, status codes or test lists (the code and tests are the source of truth).
- Describe the current state, not history. Check that every path, script and env var you mention exists, and mention doc updates in the commit message.

## Naming
- Files: feature.type.ts (meetings.service.ts)
- Methods describe the action: createMeetingWithFiles
- Variables by meaning: meetingId, not id, x, data
- Enums instead of strings: MeetingStatus.PENDING, not 'pnd'
- Constants instead of magic numbers: MAX_FILE_SIZE_MB

## Size
- File > 250 lines → decompose before adding code
- Method > 40 lines → extract into a private method
- Nesting > 3 levels → refactor

## Dependencies
- Import via the module, not directly through the service
- No circular dependencies — check before committing
- Shared types only from @app/shared/types

## Refactoring
- Before adding code to a large file — decompose it
- Tests green at every refactoring step