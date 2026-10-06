import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterUserHandler } from './commands/register-user/register-user.handler';
import { PasswordService } from './password.service';
import { LoginHandler } from './queries/login/login.handler';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '1h'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserHandler,
    LoginHandler,
    PasswordService,
    TokenService,
    JwtAuthGuard,
  ],
  // JwtModule is exported so modules using JwtAuthGuard can resolve JwtService.
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
