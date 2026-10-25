import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CommandBus,
  CommandHandler,
  ICommandHandler,
  QueryBus,
} from '@nestjs/cqrs';
import { UpdatePasswordCommand } from '../../../users/commands/update-password/update-password.command';
import { FindUserByIdQuery } from '../../../users/queries/find-user-by-id/find-user-by-id.query';
import { PasswordService } from '../../password.service';
import { ChangePasswordCommand } from './change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly passwords: PasswordService,
  ) {}

  async execute({
    userId,
    currentPassword,
    newPassword,
  }: ChangePasswordCommand): Promise<void> {
    const user = await this.queryBus.execute(new FindUserByIdQuery(userId));
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
      // `field` lets the web show it on the current password field without
      // matching the message text.
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Current password is incorrect',
        field: 'currentPassword',
      });
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.commandBus.execute(
      new UpdatePasswordCommand(user.id, user.passwordHash, passwordHash),
    );
  }
}
