import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Task } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListOpenTasksQuery } from './list-open-tasks.query';

@QueryHandler(ListOpenTasksQuery)
export class ListOpenTasksHandler implements IQueryHandler<ListOpenTasksQuery> {
  constructor(private readonly prisma: PrismaService) {}

  execute({ ownerId }: ListOpenTasksQuery): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { ownerId, status: { not: 'DONE' } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
