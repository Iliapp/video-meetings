import { Query } from '@nestjs/cqrs';
import { Task } from '../../../generated/prisma/client';

// By id alone, whoever owns the task: the caller checks ownership itself.
export class FindTaskByIdQuery extends Query<Task | null> {
  constructor(readonly id: string) {
    super();
  }
}
