import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Meeting } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMeetingCommand } from './create-meeting.command';

// The only handler for CreateMeetingCommand; the decorator binds it to the
// CommandBus, and execute() runs for every dispatched command.
@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
  constructor(private readonly prisma: PrismaService) {}

  execute({
    ownerId,
    title,
    date,
    participants,
  }: CreateMeetingCommand): Promise<Meeting> {
    return this.prisma.meeting.create({
      data: { ownerId, title, date, participants },
    });
  }
}
