import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { User } from '../../../generated/prisma/client';
import { CreateUserCommand } from '../../../users/commands/create-user/create-user.command';
import { PasswordService } from '../../password.service';
import { TokenService } from '../../token.service';
import { RegisterUserCommand } from './register-user.command';
import { RegisterUserHandler } from './register-user.handler';

describe('RegisterUserHandler', () => {
  const user = { id: 'user-id', email: 'user@example.com' } as User;
  const commandBus = { execute: jest.fn() };
  const passwords = { hash: jest.fn() };
  const tokens = { issue: jest.fn() };
  let handler: RegisterUserHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RegisterUserHandler,
        { provide: CommandBus, useValue: commandBus },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    handler = moduleRef.get(RegisterUserHandler);
  });

  it('creates the user with a hashed password through the users module and issues a token', async () => {
    passwords.hash.mockResolvedValue('hashed');
    commandBus.execute.mockResolvedValue(user);
    tokens.issue.mockResolvedValue({ accessToken: 'token' });

    await expect(
      handler.execute(new RegisterUserCommand(user.email, 'password')),
    ).resolves.toEqual({ accessToken: 'token' });
    expect(passwords.hash).toHaveBeenCalledWith('password');
    expect(commandBus.execute).toHaveBeenCalledWith(
      new CreateUserCommand(user.email, 'hashed'),
    );
    expect(tokens.issue).toHaveBeenCalledWith(user);
  });
});
