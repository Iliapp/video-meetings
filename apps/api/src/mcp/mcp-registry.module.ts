import { Module } from '@nestjs/common';
import { McpRegistry } from './mcp-registry';

// Kept apart from `McpModule` so domain modules can import it without a
// cycle: `McpModule` imports the domain modules, they import this one.
@Module({
  providers: [McpRegistry],
  exports: [McpRegistry],
})
export class McpRegistryModule {}
