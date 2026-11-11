import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Task } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertTaskCommand } from './upsert-task.command';

@CommandHandler(UpsertTaskCommand)
export class UpsertTaskHandler implements ICommandHandler<UpsertTaskCommand> {
  constructor(private readonly prisma: PrismaService) {}

  execute({ ownerId, title, status }: UpsertTaskCommand): Promise<Task> {
    return this.prisma.task.upsert({
      where: { ownerId_title: { ownerId, title } },
      create: { ownerId, title, status },
      update: { status },
    });
  }
}
