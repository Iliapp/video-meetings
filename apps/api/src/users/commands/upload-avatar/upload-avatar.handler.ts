import {
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  avatarChanged,
  detectAvatarMimeType,
  UNSUPPORTED_AVATAR_MESSAGE,
} from '../../avatar-file';
import { ProfileResponse, toProfileResponse } from '../../profile-response';
import { AvatarStorageService } from '../../storage/avatar-storage.service';
import { UploadAvatarCommand } from './upload-avatar.command';

// Validates the stored temp file, moves it into place, then points the row at
// it only if the avatar hasn't changed since it was read, and deletes whichever
// file lost: the previous one on success, the new one on failure. A rejected
// temp file is deleted by AvatarUploadInterceptor.
@CommandHandler(UploadAvatarCommand)
export class UploadAvatarHandler implements ICommandHandler<UploadAvatarCommand> {
  private readonly logger = new Logger(UploadAvatarHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AvatarStorageService,
  ) {}

  async execute({
    userId,
    file,
  }: UploadAvatarCommand): Promise<ProfileResponse> {
    const mimeType = await detectAvatarMimeType(file.path, file.originalName);
    if (!mimeType) {
      throw new UnsupportedMediaTypeException(UNSUPPORTED_AVATAR_MESSAGE);
    }
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!current) {
      throw new NotFoundException('User not found');
    }

    const avatarKey = await this.storage.commit(file.path);
    let user;
    try {
      user = await this.prisma.user.update({
        // In AND, because a unique field in the top-level filter can't be null.
        where: { id: userId, AND: { avatarKey: current.avatarKey } },
        data: { avatarKey, avatarMimeType: mimeType },
      });
    } catch (error) {
      await this.removeFile(avatarKey);
      // A concurrent upload or delete changed the avatar (or the user is gone).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw avatarChanged();
      }
      throw error;
    }

    if (current.avatarKey) {
      await this.removeFile(current.avatarKey);
    }
    return toProfileResponse(user);
  }

  // A leftover file is harmless (no row points at it), so a failure is only
  // logged.
  private async removeFile(key: string): Promise<void> {
    await this.storage.remove(key).catch((error: unknown) => {
      this.logger.error(`Could not delete avatar file ${key}`, error);
    });
  }
}
