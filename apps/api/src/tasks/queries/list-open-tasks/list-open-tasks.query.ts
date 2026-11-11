import { Query } from '@nestjs/cqrs';
import { Task } from '../../../generated/prisma/client';

// The owner's tasks that are not DONE, oldest first.
export class ListOpenTasksQuery extends Query<Task[]> {
  constructor(readonly ownerId: string) {
    super();
  }
}
