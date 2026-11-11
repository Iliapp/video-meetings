import { Query } from '@nestjs/cqrs';
import { Task } from '../../../generated/prisma/client';

export class GetTaskQuery extends Query<Task> {
  constructor(
    readonly ownerId: string,
    readonly id: string,
  ) {
    super();
  }
}
