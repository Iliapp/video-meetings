import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpRegistrar, McpRegistry } from './mcp-registry';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private registrars: readonly McpRegistrar[] = [];

  constructor(private readonly registry: McpRegistry) {}

  // Nest runs `onModuleInit` of imported modules first, and `McpModule`
  // imports the domain modules, so their registrars are in the registry by now.
  onModuleInit(): void {
    this.registrars = [...this.registry.list()];
    this.logger.log(`MCP registrars: ${this.registrars.length}`);
  }

  // The SDK's stateless transport serves exactly one request ("Stateless
  // transport cannot be reused"), and a server talks to one transport at a
  // time, so each request gets its own server, filled from the registrars.
  async handle(req: Request, res: Response): Promise<void> {
    const server = new McpServer({
      name: 'video-meetings-api',
      version: '1.0.0',
    });
    for (const registrar of this.registrars) {
      registrar.register(server);
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      this.logger.error('MCP request failed', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  }
}
