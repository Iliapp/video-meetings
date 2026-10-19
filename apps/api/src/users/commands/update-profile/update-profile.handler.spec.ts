import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { profileSelect } from '../../profile';
import { UpdateProfileCommand } from './update-profile.command';
import { UpdateProfileHandler } from './update-profile.handler';

describe('UpdateProfileHandler', () => {
  const prisma = { user: { update: jest.fn() } };
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

  it.each([['Ann'], [null]])(
    'stores the name %p and returns the profile',
    async (name) => {
      prisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        name,
      });

      await expect(
        handler.execute(new UpdateProfileCommand('user-id', name)),
      ).resolves.toEqual({
        id: 'user-id',
        email: 'user@example.com',
        name,
        avatarUrl: null,
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { name },
        select: profileSelect,
      });
    },
  );

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
