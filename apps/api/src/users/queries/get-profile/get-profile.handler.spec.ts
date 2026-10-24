import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetProfileHandler } from './get-profile.handler';
import { GetProfileQuery } from './get-profile.query';

describe('GetProfileHandler', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  let handler: GetProfileHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetProfileHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(GetProfileHandler);
  });

  it("returns the user's profile without the password hash", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Ann',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      handler.execute(new GetProfileQuery('user-id')),
    ).resolves.toEqual({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Ann',
      avatarUrl: null,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
    });
  });

  it('throws 404 when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new GetProfileQuery('user-id')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
