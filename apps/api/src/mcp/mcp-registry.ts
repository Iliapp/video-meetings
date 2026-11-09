import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';

// A domain's MCP tools/resources: puts them on a server.
export interface McpRegistrar {
  register(server: McpServer): void;
}

// Where domain modules announce their registrars; `McpService` reads it.
// Add from `onModuleInit` of a provider in the domain module, and have that
// module import `McpRegistryModule`.
@Injectable()
export class McpRegistry {
  private readonly registrars: McpRegistrar[] = [];

  add(registrar: McpRegistrar): void {
    if (!this.registrars.includes(registrar)) {
      this.registrars.push(registrar);
    }
  }

  list(): readonly McpRegistrar[] {
    return this.registrars;
  }
}
