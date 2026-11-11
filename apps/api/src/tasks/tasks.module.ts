import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { McpRegistryModule } from '../mcp/mcp-registry.module';
import { UpsertTaskHandler } from './commands/upsert-task/upsert-task.handler';
import { FindTaskByIdHandler } from './queries/find-task-by-id/find-task-by-id.handler';
import { GetTaskHandler } from './queries/get-task/get-task.handler';
import { ListOpenTasksHandler } from './queries/list-open-tasks/list-open-tasks.handler';
import { TaskService } from './task.service';
import { TaskTools } from './task-tools';
import { TasksController } from './tasks.controller';

@Module({
  imports: [AuthModule, McpRegistryModule],
  controllers: [TasksController],
  providers: [
    UpsertTaskHandler,
    ListOpenTasksHandler,
    GetTaskHandler,
    FindTaskByIdHandler,
    TaskService,
    TaskTools,
  ],
  exports: [TaskService],
})
export class TasksModule {}
