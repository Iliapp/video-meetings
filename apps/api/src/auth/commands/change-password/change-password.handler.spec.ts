import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { User } from '../../../generated/prisma/client';
import { UpdatePasswordCommand } from '../../../users/commands/update-password/update-password.command';
import { FindUserByIdQuery } from '../../../users/queries/find-user-by-id/find-user-by-id.query';
import { PasswordService } from '../../password.service';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

describe('ChangePasswordHandler', () => {
  const user = { id: 'user-id', passwordHash: 'old-hash' } as User;
  const commandBus = { execute: jest.fn() };
  const queryBus = { execute: jest.fn() };
  const passwords = { verify: jest.fn(), hash: jest.fn() };
  let handler: ChangePasswordHandler;

  const change = () =>
    handler.execute(new ChangePasswordCommand('user-id', 'current', 'new'));

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChangePasswordHandler,
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: PasswordService, useValue: passwords },
      ],
    }).compile();
    handler = moduleRef.get(ChangePasswordHandler);
  });

  it('verifies the current password and stores the new hash through the users module', async () => {
    queryBus.execute.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(true);
    passwords.hash.mockResolvedValue('new-hash');

    await expect(change()).resolves.toBeUndefined();
    expect(queryBus.execute).toHaveBeenCalledWith(
      new FindUserByIdQuery('user-id'),
    );
    expect(passwords.verify).toHaveBeenCalledWith('current', 'old-hash');
    expect(passwords.hash).toHaveBeenCalledWith('new');
    expect(commandBus.execute).toHaveBeenCalledWith(
      new UpdatePasswordCommand('user-id', 'old-hash', 'new-hash'),
    );
  });

  it('throws 401 and keeps the password when the current one is wrong', async () => {
    queryBus.execute.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(false);

    await expect(change()).rejects.toThrow(
      new UnauthorizedException('Current password is incorrect'),
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('throws 404 when the user no longer exists', async () => {
    queryBus.execute.mockResolvedValue(null);

    await expect(change()).rejects.toBeInstanceOf(NotFoundException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
