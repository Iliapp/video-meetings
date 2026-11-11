import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpController } from './mcp.controller';
import { McpRegistryModule } from './mcp-registry.module';
import { McpService } from './mcp.service';

@Module({
  // Domain modules that expose MCP tools go here: importing them makes Nest
  // initialize them (and so fill the registry) before `McpService` starts.
  imports: [AuthModule, McpRegistryModule, TasksModule],
  controllers: [McpController],
  providers: [McpService, McpAuthGuard],
})
export class McpModule {}
