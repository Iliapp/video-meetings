import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from './api-client.js';
import { findTasks, findTasksInput } from './find-tasks.js';

export function createServer(api: ApiClient): McpServer {
  const server = new McpServer({ name: 'video-meetings', version: '0.0.1' });

  server.registerTool(
    'find_tasks',
    {
      title: 'Find tasks',
      description:
        'Find tasks (meetings) visible to the current user, optionally filtered by title text and date range. Sorted by date.',
      inputSchema: findTasksInput,
    },
    async (input) => {
      try {
        const tasks = findTasks(await api.listTasks(), input);
        return {
          content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }
    },
  );

  return server;
}
