import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersService } from '../../../users/users.service';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { PasswordService } from '../../password.service';
import { TokenService } from '../../token.service';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async execute({
    email,
    password,
  }: RegisterUserCommand): Promise<AuthResponseDto> {
    const passwordHash = await this.passwords.hash(password);
    const user = await this.users.create(email, passwordHash);
    return this.tokens.issue(user);
  }
}
