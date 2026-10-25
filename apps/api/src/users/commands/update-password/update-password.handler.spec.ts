import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdatePasswordCommand } from './update-password.command';
import { UpdatePasswordHandler } from './update-password.handler';

describe('UpdatePasswordHandler', () => {
  const prisma = { user: { updateMany: jest.fn() } };
  let handler: UpdatePasswordHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdatePasswordHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(UpdatePasswordHandler);
  });

  it('replaces the hash only while the stored one is still the expected hash', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      handler.execute(new UpdatePasswordCommand('user-id', 'old', 'new')),
    ).resolves.toBeUndefined();
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-id', passwordHash: 'old' },
      data: { passwordHash: 'new' },
    });
  });

  it('throws 409 when the password changed in the meantime', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      handler.execute(new UpdatePasswordCommand('user-id', 'old', 'new')),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
