import { Command } from '@nestjs/cqrs';
import { AuthResponseDto } from '../../dto/auth-response.dto';

export class RegisterUserCommand extends Command<AuthResponseDto> {
  constructor(
    readonly email: string,
    readonly password: string,
  ) {
    super();
  }
}
