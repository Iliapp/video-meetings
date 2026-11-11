import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Task } from '../generated/prisma/client';
import { UpsertTaskDto } from './dto/upsert-task.dto';
import { TaskService } from './task.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TaskService) {}

  // Idempotent: the same title always addresses the caller's same task.
  @Put()
  @HttpCode(200)
  upsert(
    @CurrentUser() user: AuthUser,
    @Body() { title, status }: UpsertTaskDto,
  ): Promise<Task> {
    return this.tasks.upsert(user.id, title, status);
  }

  // Open = not DONE.
  @Get()
  listOpen(@CurrentUser() user: AuthUser): Promise<Task[]> {
    return this.tasks.listOpen(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Task> {
    return this.tasks.get(user.id, id);
  }
}
