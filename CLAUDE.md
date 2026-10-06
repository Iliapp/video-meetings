# video-meetings

Video meetings monorepo: a Next.js web client (`apps/web`) and a NestJS API (`apps/api`). The browser calls the api directly over REST/JSON at `NEXT_PUBLIC_API_URL`; the api allows it via CORS (`WEB_ORIGIN`) and authenticates with a `Bearer` JWT.
Each app has its own `CLAUDE.md` with app-specific notes; read it before working in that app.

## Tooling

- Package manager is **pnpm only** (`pnpm@12.8.1`, enforced via `devEngines`). `npm`/`npx` fail with `EBADDEVENGINES`; use `pnpm` / `pnpm dlx`.
- Workspace: `pnpm-workspace.yaml` includes `apps/*`; dependency install scripts run only for packages listed in its `allowBuilds`. Add a dependency to one app with `pnpm --filter <web|api> add <pkg>`.
- Formatting: Prettier at the root (`.prettierrc`: single quotes, trailing commas). Both apps' ESLint configs include `eslint-config-prettier`. A Claude Code `PostToolUse` hook (`.claude/settings.json` → `.claude/hooks/format.mjs`) runs Prettier on every file Claude writes or edits.
- Git hooks: Husky (`.husky/`, installed by the root `prepare` script on `pnpm install`). `pre-commit` runs `pnpm lint` and `pnpm test` (unit only; e2e needs Postgres, run it manually). Bypass in an emergency with `git commit --no-verify`.
- MCP: `.mcp.json` registers the Playwright MCP server (`playwright`, run via `pnpm dlx @playwright/mcp@latest`) for browser automation against the running web app.

## Commands (from repo root)

| Command                             | What it does                                          |
| ----------------------------------- | ----------------------------------------------------- |
| `pnpm dev`                          | Run all apps in parallel (web on :3000, api on :4000) |
| `pnpm dev:web` / `pnpm dev:api`     | Run a single app                                      |
| `pnpm build`                        | Build all apps                                        |
| `pnpm lint`                         | Lint all apps                                         |
| `pnpm test`                         | Run unit tests in all apps (api only; web has none)   |
| `pnpm format` / `pnpm format:check` | Prettier write / check for the whole repo             |
| `pnpm db:up` / `pnpm db:down`       | Start (and wait until healthy) / stop local Postgres  |
| `pnpm db:logs`                      | Follow Postgres logs                                  |

## Local database

`docker-compose.yml` at the root runs PostgreSQL 17 (`postgres:17-alpine`, container `video-meetings-postgres`) on `localhost:5432`, data in the `postgres-data` volume. Defaults: user `postgres`, password `postgres`, database `video_meetings`; override with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` (env or a root `.env`). Connection string: `postgresql://postgres:postgres@localhost:5432/video_meetings`. Requires Docker Desktop running. `docker compose down -v` wipes the data. The api's e2e tests use a separate `video_meetings_test` database on the same server (created automatically).

## Conventions

- TypeScript strict mode everywhere.
- Refactoring: run the affected app's tests (api: `pnpm test` and `pnpm test:e2e`, see `apps/api/CLAUDE.md`) and confirm they are green before you start, then run them again after each step. Don't continue from a red state. Tests that fail beforehand are reported, not fixed silently.
- Don't commit build output (`dist`, `.next`, `*.tsbuildinfo`) or `.env*` files; they are gitignored.
- Agent skills live in `.agents/skills/` (tracked in `skills-lock.json`) and are symlinked into `.claude/skills/`. Install new ones with `pnpm dlx skills add <source>`.

## Keeping docs in sync with architecture

Update the docs in the same change as the code. A task that changes the architecture is not done until they match.

Which file to update:

- **Root `CLAUDE.md`** for anything that affects the whole repo: a new or removed app or package in the workspace, how the apps talk to each other, shared tooling (pnpm, Prettier, ESLint, TypeScript), root scripts, ports, and repo-wide conventions.
- **`apps/<app>/CLAUDE.md`** for anything inside one app: its Structure section (new top-level folders, modules, routes, entry points), framework or major-library swaps and version bumps, new commands or scripts, required env vars, and app conventions.
- **`skills-lock.json` + a mention in the relevant `CLAUDE.md`** when you add or remove a skill or a library a skill covers (for example, if HeroUI is replaced, remove or replace `heroui-react` and update `apps/web/CLAUDE.md`).
- Don't edit generated files (`apps/web/AGENTS.md`).

What counts as an architecture change: adding, removing or renaming an app, a NestJS feature module, or a top-level folder; changing a framework, UI library, state, data or realtime layer (database, ORM, WebSocket/WebRTC signaling, auth); changing how web and api communicate (URLs, protocols, shared types); adding or renaming env vars, scripts, ports, or build and test setup.

How to write it:

- Describe the current state, not history. Replace outdated lines instead of appending "now we use X". Delete text about things that no longer exist.
- Keep it short: what exists, where it lives, which command to run, and which rule to follow. Don't restate what is obvious from the code.
- Before finishing, check that every path, script and env var named in the touched docs still exists (`ls`, `package.json`), and run `pnpm format`.
- Mention the doc updates in the commit message or PR description.
