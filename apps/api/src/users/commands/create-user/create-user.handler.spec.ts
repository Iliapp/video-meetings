import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, User } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserCommand } from './create-user.command';
import { CreateUserHandler } from './create-user.handler';

describe('CreateUserHandler', () => {
  const prisma = { user: { create: jest.fn() } };
  let handler: CreateUserHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateUserHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(CreateUserHandler);
  });

  it('creates the user', async () => {
    const user = { id: 'user-id' } as User;
    prisma.user.create.mockResolvedValue(user);

    await expect(
      handler.execute(new CreateUserCommand('user@example.com', 'hash')),
    ).resolves.toBe(user);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'user@example.com', passwordHash: 'hash' },
    });
  });

  it('maps a unique-email violation to 409', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      handler.execute(new CreateUserCommand('user@example.com', 'hash')),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
