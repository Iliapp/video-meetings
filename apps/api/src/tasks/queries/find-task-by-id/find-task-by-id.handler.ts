import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { Task } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FindTaskByIdQuery } from './find-task-by-id.query';

@QueryHandler(FindTaskByIdQuery)
export class FindTaskByIdHandler implements IQueryHandler<FindTaskByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: FindTaskByIdQuery): Promise<Task | null> {
    return isUUID(id) ? this.prisma.task.findUnique({ where: { id } }) : null;
  }
}
