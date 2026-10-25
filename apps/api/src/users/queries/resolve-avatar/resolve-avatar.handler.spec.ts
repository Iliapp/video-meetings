import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { AvatarStorageService } from '../../storage/avatar-storage.service';
import { ResolveAvatarHandler } from './resolve-avatar.handler';
import { ResolveAvatarQuery } from './resolve-avatar.query';

describe('ResolveAvatarHandler', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const storage = { pathFor: jest.fn() };
  let handler: ResolveAvatarHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    storage.pathFor.mockImplementation((key: string) => `/avatars/${key}`);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveAvatarHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: AvatarStorageService, useValue: storage },
      ],
    }).compile();
    handler = moduleRef.get(ResolveAvatarHandler);
  });

  it('returns the file path and stored MIME type of a current avatar', async () => {
    const key = randomUUID();
    prisma.user.findUnique.mockResolvedValue({ avatarMimeType: 'image/webp' });

    await expect(handler.execute(new ResolveAvatarQuery(key))).resolves.toEqual(
      { path: `/avatars/${key}`, mimeType: 'image/webp' },
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { avatarKey: key },
      select: { avatarMimeType: true },
    });
  });

  it('answers 404 for a key no user has (replaced or removed)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new ResolveAvatarQuery(randomUUID())),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 404 for a non-UUID key without querying', async () => {
    await expect(
      handler.execute(new ResolveAvatarQuery('../etc/passwd')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
