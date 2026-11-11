import { Command } from '@nestjs/cqrs';
import { Task, TaskStatus } from '../../../generated/prisma/client';

// Creates the owner's task with this title, or sets its status if it exists.
export class UpsertTaskCommand extends Command<Task> {
  constructor(
    readonly ownerId: string,
    readonly title: string,
    readonly status: TaskStatus,
  ) {
    super();
  }
}
