import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient } from './api-client.js';
import { createServer } from './server.js';

// Runs as a child process of an MCP client and talks over stdio, so stdout is
// the protocol channel: log to stderr only.
const email = process.env.API_EMAIL;
const password = process.env.API_PASSWORD;
if (!email || !password) {
  console.error('API_EMAIL and API_PASSWORD are required (an api user)');
  process.exit(1);
}

const url = (process.env.API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

await createServer(createApiClient({ url, email, password })).connect(
  new StdioServerTransport(),
);
console.error(`video-meetings MCP server running on stdio (api: ${url})`);
