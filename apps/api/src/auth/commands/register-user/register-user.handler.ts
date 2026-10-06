import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from '../../../users/commands/create-user/create-user.command';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { PasswordService } from '../../password.service';
import { TokenService } from '../../token.service';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async execute({
    email,
    password,
  }: RegisterUserCommand): Promise<AuthResponseDto> {
    const passwordHash = await this.passwords.hash(password);
    const user = await this.commandBus.execute(
      new CreateUserCommand(email, passwordHash),
    );
    return this.tokens.issue(user);
  }
}
