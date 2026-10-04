import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { User } from '../../../generated/prisma/client';
import { UsersService } from '../../../users/users.service';
import { PasswordService } from '../../password.service';
import { TokenService } from '../../token.service';
import { LoginHandler } from './login.handler';
import { LoginQuery } from './login.query';

describe('LoginHandler', () => {
  const user: User = {
    id: 'user-id',
    email: 'user@example.com',
    passwordHash: 'stored-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const users = { findByEmail: jest.fn() };
  const passwords = { verify: jest.fn(), dummyHash: jest.fn() };
  const tokens = { issue: jest.fn() };
  let handler: LoginHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    passwords.dummyHash.mockResolvedValue('dummy-hash');
    tokens.issue.mockResolvedValue({ accessToken: 'token' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        LoginHandler,
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();

    handler = moduleRef.get(LoginHandler);
  });

  it('returns a token when the password matches', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(true);

    await expect(
      handler.execute(new LoginQuery(user.email, 'password')),
    ).resolves.toEqual({ accessToken: 'token' });
    expect(passwords.verify).toHaveBeenCalledWith('password', 'stored-hash');
    expect(tokens.issue).toHaveBeenCalledWith(user);
  });

  it('rejects a wrong password', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwords.verify.mockResolvedValue(false);

    await expect(
      handler.execute(new LoginQuery(user.email, 'wrong')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  // Hashing for unknown emails too keeps response time from revealing which emails exist.
  it('still verifies a password against a dummy hash when the user does not exist', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwords.verify.mockResolvedValue(true);

    await expect(
      handler.execute(new LoginQuery('nobody@example.com', 'password')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwords.verify).toHaveBeenCalledWith('password', 'dummy-hash');
    expect(tokens.issue).not.toHaveBeenCalled();
  });
});
