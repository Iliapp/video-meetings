# mcp (MCP server)

Standalone MCP server on `@modelcontextprotocol/sdk`, run by an MCP client as a child process over **stdio** (stdout is the protocol channel: log to stderr only). ESM, TypeScript `nodenext`, Zod 4 for tool schemas.

## Environment

- `API_EMAIL`, `API_PASSWORD`: required, the api user the server acts as. It logs in with `POST /auth/login` lazily and again on `401`, so the api only returns meetings that user owns or is invited to.
- `API_URL`: api base URL, default `http://localhost:4000`.

## Commands (run in `apps/mcp`, or `pnpm --filter mcp <script>` from root)

- `pnpm build`: compile to `dist/`; `pnpm start`: run `dist/main.js`
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (Jest, `*.spec.ts` next to sources)

## Structure

- `src/main.ts`: reads env, connects `createServer(...)` to `StdioServerTransport`.
- `src/server.ts`: `McpServer({ name, version })` and the tools, registered with `registerTool`.
- `src/find-tasks.ts`: `find_tasks` Zod input (`query`, `from`, `to`) and the pure `findTasks` filter. A "task" is a meeting.
- `src/api-client.ts`: login + `GET /meetings` (reuses the api's `ListMeetingsQuery` and its access rules; no direct DB access).

Only `find_tasks` exists; add tools in `server.ts`.
