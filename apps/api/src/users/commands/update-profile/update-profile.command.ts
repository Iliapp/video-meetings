import { Command } from '@nestjs/cqrs';
import { ProfileResponse } from '../../profile-response';

// name: a string sets it, null clears it, undefined keeps the stored one.
// Throws NotFoundException when the user no longer exists.
export class UpdateProfileCommand extends Command<ProfileResponse> {
  constructor(
    readonly userId: string,
    readonly name: string | null | undefined,
  ) {
    super();
  }
}
