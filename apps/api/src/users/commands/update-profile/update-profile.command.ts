import { Command } from '@nestjs/cqrs';
import { Profile } from '../../profile';

// `name: null` clears the name. Throws NotFoundException when the user no longer exists.
export class UpdateProfileCommand extends Command<Profile> {
  constructor(
    readonly userId: string,
    readonly name: string | null,
  ) {
    super();
  }
}
