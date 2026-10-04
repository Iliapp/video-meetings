import { UnauthorizedException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UsersService } from '../../../users/users.service';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { PasswordService } from '../../password.service';
import { TokenService } from '../../token.service';
import { LoginQuery } from './login.query';

@QueryHandler(LoginQuery)
export class LoginHandler implements IQueryHandler<LoginQuery> {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: LoginQuery): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(email);
    // Hash even when the user is missing, and fail with the same error, so
    // neither the response nor its timing reveals which emails are registered.
    const valid = await this.passwords.verify(
      password,
      user?.passwordHash ?? (await this.passwords.dummyHash()),
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokens.issue(user);
  }
}
