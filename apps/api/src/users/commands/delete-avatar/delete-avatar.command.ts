import { Command } from '@nestjs/cqrs';

// Removes the user's avatar; no avatar is not an error.
export class DeleteAvatarCommand extends Command<void> {
  constructor(readonly userId: string) {
    super();
  }
}
