import { Command } from '@nestjs/cqrs';

// Replaces the password hash only while the stored one is still
// expectedPasswordHash (the one the caller verified against); otherwise throws
// ConflictException, so a concurrent change or deleted user isn't overwritten.
export class UpdatePasswordCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly expectedPasswordHash: string,
    readonly passwordHash: string,
  ) {
    super();
  }
}
