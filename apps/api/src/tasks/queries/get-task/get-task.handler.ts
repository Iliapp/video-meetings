import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { Task } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetTaskQuery } from './get-task.query';

@QueryHandler(GetTaskQuery)
export class GetTaskHandler implements IQueryHandler<GetTaskQuery> {
  constructor(private readonly prisma: PrismaService) {}

  // Malformed ids and other users' tasks both answer 404.
  async execute({ ownerId, id }: GetTaskQuery): Promise<Task> {
    const task = isUUID(id)
      ? await this.prisma.task.findFirst({ where: { id, ownerId } })
      : null;
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }
}
