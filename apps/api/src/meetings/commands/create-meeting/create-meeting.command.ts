import { Command } from '@nestjs/cqrs';
import { Meeting } from '../../../generated/prisma/client';

// Command: an immutable message asking to change state (create a meeting).
// The generic in Command<Meeting> types what commandBus.execute() returns.
export class CreateMeetingCommand extends Command<Meeting> {
  constructor(
    readonly ownerId: string,
    readonly title: string,
    readonly date: Date,
    readonly participants: string[],
  ) {
    super();
  }
}
