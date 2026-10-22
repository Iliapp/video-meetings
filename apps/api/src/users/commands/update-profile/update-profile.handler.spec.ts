import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateProfileCommand } from './update-profile.command';
import { UpdateProfileHandler } from './update-profile.handler';

describe('UpdateProfileHandler', () => {
  const prisma = { user: { update: jest.fn() } };
  const user = {
    id: 'user-id',
    email: 'user@example.com',
    name: 'Ann',
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let handler: UpdateProfileHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateProfileHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(UpdateProfileHandler);
  });

  it('saves the name and returns the profile', async () => {
    prisma.user.update.mockResolvedValue(user);

    await expect(
      handler.execute(new UpdateProfileCommand('user-id', 'Ann')),
    ).resolves.toEqual({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Ann',
      avatarUrl: null,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { name: 'Ann' },
    });
  });

  it('clears the name with null', async () => {
    prisma.user.update.mockResolvedValue({ ...user, name: null });

    await expect(
      handler.execute(new UpdateProfileCommand('user-id', null)),
    ).resolves.toMatchObject({ name: null });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { name: null },
    });
  });

  it('leaves the name unchanged when it is undefined', async () => {
    prisma.user.update.mockResolvedValue(user);

    await expect(
      handler.execute(new UpdateProfileCommand('user-id', undefined)),
    ).resolves.toMatchObject({ name: 'Ann' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { name: undefined },
    });
  });

  it('throws 404 when the user no longer exists', async () => {
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      handler.execute(new UpdateProfileCommand('user-id', 'Ann')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rethrows other errors', async () => {
    const error = new Error('connection lost');
    prisma.user.update.mockRejectedValue(error);

    await expect(
      handler.execute(new UpdateProfileCommand('user-id', 'Ann')),
    ).rejects.toBe(error);
  });
});
