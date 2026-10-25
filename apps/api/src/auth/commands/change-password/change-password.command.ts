import { Command } from '@nestjs/cqrs';

// Wrong currentPassword → UnauthorizedException; the user no longer exists →
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
