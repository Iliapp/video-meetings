import { ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdatePasswordCommand } from './update-password.command';

@CommandHandler(UpdatePasswordCommand)
export class UpdatePasswordHandler implements ICommandHandler<UpdatePasswordCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    userId,
    expectedPasswordHash,
    passwordHash,
  }: UpdatePasswordCommand): Promise<void> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, passwordHash: expectedPasswordHash },
      data: { passwordHash },
    });
    if (count === 0) {
      throw new ConflictException(
        'The password was changed by another request, try again',
      );
    }
  }
}
