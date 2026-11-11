import { Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { avatarChanged } from '../../avatar-file';
import { AvatarStorageService } from '../../storage/avatar-storage.service';
import { DeleteAvatarCommand } from './delete-avatar.command';

// Clears the row first (only if the avatar hasn't changed since it was read),
// so the avatar is gone for users even if the file can't be removed; that
// failure is only logged.
@CommandHandler(DeleteAvatarCommand)
export class DeleteAvatarHandler implements ICommandHandler<DeleteAvatarCommand> {
  private readonly logger = new Logger(DeleteAvatarHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AvatarStorageService,
  ) {}

  async execute({ userId }: DeleteAvatarCommand): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!current) {
      throw new NotFoundException('User not found');
    }
    const { avatarKey } = current;
    if (!avatarKey) {
      return;
    }

    try {
      await this.prisma.user.update({
        where: { id: userId, avatarKey },
        data: { avatarKey: null, avatarMimeType: null },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw avatarChanged();
      }
      throw error;
    }

    await this.storage.remove(avatarKey).catch((removeError: unknown) => {
      this.logger.error(
        `Could not delete avatar file ${avatarKey}`,
        removeError,
      );
    });
  }
}
