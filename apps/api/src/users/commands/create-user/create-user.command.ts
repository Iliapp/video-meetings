import { Command } from '@nestjs/cqrs';
import { User } from '../../../generated/prisma/client';

// Throws ConflictException when the email is already registered.
export class CreateUserCommand extends Command<User> {
  constructor(
    readonly email: string,
    readonly passwordHash: string,
  ) {
    super();
  }
}
