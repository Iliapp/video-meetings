import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AvatarStorageService } from '../../storage/avatar-storage.service';
import { DeleteAvatarCommand } from './delete-avatar.command';
import { DeleteAvatarHandler } from './delete-avatar.handler';

describe('DeleteAvatarHandler', () => {
  const command = new DeleteAvatarCommand('user-id');
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const storage = { remove: jest.fn() };
  let handler: DeleteAvatarHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    storage.remove.mockResolvedValue(undefined);
    prisma.user.update.mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeleteAvatarHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: AvatarStorageService, useValue: storage },
      ],
    }).compile();
    handler = moduleRef.get(DeleteAvatarHandler);
  });

  it('clears the key and MIME type, then deletes the file', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old-key' });

    await expect(handler.execute(command)).resolves.toBeUndefined();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id', avatarKey: 'old-key' },
      data: { avatarKey: null, avatarMimeType: null },
    });
    expect(storage.remove).toHaveBeenCalledWith('old-key');
  });

  it('does nothing when there is no avatar', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: null });

    await expect(handler.execute(command)).resolves.toBeUndefined();

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('answers 404 when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers 409 and keeps the files when another request changed the avatar first', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old-key' });
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('succeeds when the file cannot be deleted (only logged)', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old-key' });
    storage.remove.mockRejectedValue(new Error('EACCES'));

    await expect(handler.execute(command)).resolves.toBeUndefined();
  });
});
