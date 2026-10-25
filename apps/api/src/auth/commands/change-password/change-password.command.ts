import { Command } from '@nestjs/cqrs';

// Wrong currentPassword → BadRequestException (not 401: the web treats a 401
// as a lost session and signs out); the user no longer exists →
// NotFoundException. Tokens already issued stay valid.
export class ChangePasswordCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly currentPassword: string,
    readonly newPassword: string,
  ) {
    super();
  }
}
