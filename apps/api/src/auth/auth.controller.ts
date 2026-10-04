import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from './commands/register-user/register-user.command';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginQuery } from './queries/login/login.query';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('register')
  register(@Body() { email, password }: RegisterDto): Promise<AuthResponseDto> {
    return this.commandBus.execute(new RegisterUserCommand(email, password));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() { email, password }: LoginDto): Promise<AuthResponseDto> {
    return this.queryBus.execute(new LoginQuery(email, password));
  }
}
