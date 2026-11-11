import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthUser } from '../auth/auth-user';
import { Meeting, Task, TaskStatus } from '../generated/prisma/client';
import { ListMeetingsQuery } from '../meetings/queries/list-meetings/list-meetings.query';
import { UpsertTaskCommand } from './commands/upsert-task/upsert-task.command';
import { FindTaskByIdQuery } from './queries/find-task-by-id/find-task-by-id.query';
import { GetTaskQuery } from './queries/get-task/get-task.query';
import { ListOpenTasksQuery } from './queries/list-open-tasks/list-open-tasks.query';

export interface FindTasksFilter {
  query?: string;
  from?: string;
  to?: string;
}

// The one entry point to tasks for every caller (HTTP controller, MCP tools):
// callers pass the acting user, this service sends the commands and queries.
@Injectable()
export class TaskService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Creates the owner's task with this title, or sets its status. */
  upsert(ownerId: string, title: string, status: TaskStatus): Promise<Task> {
    return this.commandBus.execute(
      new UpsertTaskCommand(ownerId, title, status),
    );
  }

  /** The owner's tasks that are not DONE, oldest first. */
  listOpen(ownerId: string): Promise<Task[]> {
    return this.queryBus.execute(new ListOpenTasksQuery(ownerId));
  }

  /** One of the owner's tasks; unknown or foreign id → `404 Task not found`. */
  get(ownerId: string, id: string): Promise<Task> {
    return this.queryBus.execute(new GetTaskQuery(ownerId, id));
  }

  /**
   * `task://{id}`: the id says which task to read, not that the requester may
   * see it. Loads the task, then checks the owner: unknown or malformed id →
   * `404 Task not found`, another user's task → `403`.
   */
  async getAuthorized(requesterId: string, id: string): Promise<Task> {
    const task = await this.queryBus.execute(new FindTaskByIdQuery(id));
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.ownerId !== requesterId) {
      throw new ForbiddenException('Task belongs to another user');
    }
    return task;
  }

  /**
   * `find_tasks`: a "task" there is a meeting the user owns or is invited to
   * (the same set as `GET /meetings`), filtered by title text and date range.
   */
  async find(
    user: AuthUser,
    { query, from, to }: FindTasksFilter,
  ): Promise<Meeting[]> {
    const meetings = await this.queryBus.execute(new ListMeetingsQuery(user));
    const needle = query?.toLowerCase();
    const fromMs = from === undefined ? undefined : Date.parse(from);
    const toMs = to === undefined ? undefined : Date.parse(to);
    return meetings.filter((meeting) => {
      const date = meeting.date.getTime();
      return (
        (needle === undefined ||
          meeting.title.toLowerCase().includes(needle)) &&
        (fromMs === undefined || date >= fromMs) &&
        (toMs === undefined || date <= toMs)
      );
    });
  }
}
