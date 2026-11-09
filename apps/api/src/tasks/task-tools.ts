import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { TaskStatus } from '../generated/prisma/client';
import { McpRegistrar, McpRegistry } from '../mcp/mcp-registry';
import { mcpUser } from '../mcp/mcp-user';
import { TaskService } from './task.service';

const json = (value: unknown) => JSON.stringify(value, null, 2);

// MCP face of `TaskService`: tools and resources only call its methods.
// Thrown errors become `isError` tool results / JSON-RPC errors in the SDK.
@Injectable()
export class TaskTools implements McpRegistrar, OnModuleInit {
  constructor(
    private readonly tasks: TaskService,
    private readonly registry: McpRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.add(this);
  }

  register(server: McpServer): void {
    server.registerTool(
      'find_tasks',
      {
        title: 'Find tasks',
        description:
          'Find tasks (meetings) visible to the current user, optionally filtered by title text and date range. Sorted by date.',
        inputSchema: {
          query: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe('Case-insensitive text to look for in the title'),
          from: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('Only tasks on or after this ISO 8601 date-time'),
          to: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('Only tasks on or before this ISO 8601 date-time'),
        },
        annotations: { readOnlyHint: true },
      },
      async (input, extra) => ({
        content: [
          {
            type: 'text',
            text: json(await this.tasks.find(mcpUser(extra), input)),
          },
        ],
      }),
    );

    server.registerTool(
      'upsert_task',
      {
        title: 'Create or update a task',
        description:
          'Create a task with the given title, or set the status of the existing task with that title.',
        inputSchema: {
          title: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe(
              'Task title; an existing task with the same title is updated',
            ),
          status: z
            .enum(Object.values(TaskStatus) as [TaskStatus, ...TaskStatus[]])
            .describe('New status of the task'),
        },
        annotations: { readOnlyHint: false },
      },
      async ({ title, status }, extra) => ({
        content: [
          {
            type: 'text',
            text: json(
              await this.tasks.upsert(mcpUser(extra).id, title, status),
            ),
          },
        ],
      }),
    );

    server.registerResource(
      'open-tasks',
      'tasks://open',
      {
        title: 'Open tasks',
        description: 'Tasks that are not done yet',
        mimeType: 'application/json',
      },
      async (uri, extra) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: json(await this.tasks.listOpen(mcpUser(extra).id)),
          },
        ],
      }),
    );

    server.registerResource(
      'task',
      new ResourceTemplate('task://{id}', { list: undefined }),
      {
        title: 'Task',
        description: 'One task by id',
        mimeType: 'application/json',
      },
      async (uri, { id }, extra) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: json(
              await this.tasks.getAuthorized(
                mcpUser(extra).id,
                Array.isArray(id) ? id[0] : id,
              ),
            ),
          },
        ],
      }),
    );
  }
}
