import {
  ConflictException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { detectAvatarMimeType } from '../../avatar-file';
import { AvatarStorageService } from '../../storage/avatar-storage.service';
import { UploadAvatarCommand } from './upload-avatar.command';
import { UploadAvatarHandler } from './upload-avatar.handler';

jest.mock('../../avatar-file', () => ({
  ...jest.requireActual<object>('../../avatar-file'),
  detectAvatarMimeType: jest.fn(),
}));

describe('UploadAvatarHandler', () => {
  const file = { path: '/avatars/incoming/temp', originalName: 'me.png' };
  const command = new UploadAvatarCommand('user-id', file);
  const detect = jest.mocked(detectAvatarMimeType);
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const storage = { commit: jest.fn(), remove: jest.fn() };
  const user = {
    id: 'user-id',
    email: 'user@example.com',
    name: 'Ann',
    avatarKey: 'new-key',
    avatarMimeType: 'image/png',
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let handler: UploadAvatarHandler;

  const notFound = () =>
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    detect.mockResolvedValue('image/png');
    storage.commit.mockResolvedValue('new-key');
    storage.remove.mockResolvedValue(undefined);
    prisma.user.update.mockResolvedValue(user);
    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadAvatarHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: AvatarStorageService, useValue: storage },
      ],
    }).compile();
    handler = moduleRef.get(UploadAvatarHandler);
  });

  it('commits the file, saves its key and MIME type and returns the profile', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: null });

    await expect(handler.execute(command)).resolves.toMatchObject({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Ann',
    });
    expect(detect).toHaveBeenCalledWith(file.path, file.originalName);
    expect(storage.commit).toHaveBeenCalledWith(file.path);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id', AND: { avatarKey: null } },
      data: { avatarKey: 'new-key', avatarMimeType: 'image/png' },
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('deletes the previous file after the row points at the new one', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old-key' });

    await handler.execute(command);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-id', AND: { avatarKey: 'old-key' } },
      }),
    );
    expect(storage.remove).toHaveBeenCalledWith('old-key');
    expect(storage.remove).not.toHaveBeenCalledWith('new-key');
  });

  it('still succeeds when the previous file cannot be deleted', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old-key' });
    storage.remove.mockRejectedValue(new Error('EACCES'));

    await expect(handler.execute(command)).resolves.toMatchObject({
      id: 'user-id',
    });
  });

  // The temp file itself is deleted by AvatarUploadInterceptor.
  it('rejects an unsupported file with 415 and changes nothing', async () => {
    detect.mockResolvedValue(undefined);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(storage.commit).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('answers 404 before committing when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.commit).not.toHaveBeenCalled();
  });

  it('answers 409 and deletes the new file when another request changed the avatar first', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old-key' });
    prisma.user.update.mockRejectedValue(notFound());

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(storage.remove).toHaveBeenCalledWith('new-key');
    expect(storage.remove).not.toHaveBeenCalledWith('old-key');
  });

  it('deletes the new file and rethrows when the row cannot be updated', async () => {
    const error = new Error('database is down');
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old-key' });
    prisma.user.update.mockRejectedValue(error);

    await expect(handler.execute(command)).rejects.toBe(error);
    expect(storage.remove).toHaveBeenCalledWith('new-key');
    expect(storage.remove).not.toHaveBeenCalledWith('old-key');
  });

  it('keeps the original error when the new file cannot be deleted', async () => {
    const error = new Error('database is down');
    prisma.user.findUnique.mockResolvedValue({ avatarKey: null });
    prisma.user.update.mockRejectedValue(error);
    storage.remove.mockRejectedValue(new Error('EACCES'));

    await expect(handler.execute(command)).rejects.toBe(error);
  });
});
