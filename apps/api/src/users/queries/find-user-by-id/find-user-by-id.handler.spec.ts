import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { FindUserByIdHandler } from './find-user-by-id.handler';
import { FindUserByIdQuery } from './find-user-by-id.query';

describe('FindUserByIdHandler', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  let handler: FindUserByIdHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FindUserByIdHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(FindUserByIdHandler);
  });

  it('returns the user with that id', async () => {
    const user = { id: 'user-id', email: 'user@example.com' };
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      handler.execute(new FindUserByIdQuery('user-id')),
    ).resolves.toBe(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
    });
  });

  it('returns null when there is no such user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new FindUserByIdQuery('user-id')),
    ).resolves.toBeNull();
  });
});
