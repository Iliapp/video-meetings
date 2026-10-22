import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreateUserHandler } from './commands/create-user/create-user.handler';
import { UpdateProfileHandler } from './commands/update-profile/update-profile.handler';
import { ProfileController } from './profile.controller';
import { FindUserByEmailHandler } from './queries/find-user-by-email/find-user-by-email.handler';
import { GetProfileHandler } from './queries/get-profile/get-profile.handler';

// Owns user records. Other modules reach it only through the buses
// (CreateUserCommand, FindUserByEmailQuery), so nothing imports this module
// except AppModule, which registers its handlers and ProfileController.
@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [
    CreateUserHandler,
    FindUserByEmailHandler,
    GetProfileHandler,
    UpdateProfileHandler,
  ],
})
export class UsersModule {}
