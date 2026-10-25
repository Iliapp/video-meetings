import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../../prisma/prisma.service';
import { AvatarStorageService } from '../../storage/avatar-storage.service';
import { AvatarFile, ResolveAvatarQuery } from './resolve-avatar.query';

export const avatarNotFound = () => new NotFoundException('Avatar not found');

@QueryHandler(ResolveAvatarQuery)
export class ResolveAvatarHandler implements IQueryHandler<ResolveAvatarQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AvatarStorageService,
  ) {}

  async execute({ key }: ResolveAvatarQuery): Promise<AvatarFile> {
    if (!isUUID(key)) {
      throw avatarNotFound();
    }
    const user = await this.prisma.user.findUnique({
      where: { avatarKey: key },
      select: { avatarMimeType: true },
    });
    if (!user?.avatarMimeType) {
      throw avatarNotFound();
    }
    return { path: this.storage.pathFor(key), mimeType: user.avatarMimeType };
  }
}
