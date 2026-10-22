import { Module } from '@nestjs/common';
import { CreateUserHandler } from './commands/create-user/create-user.handler';
import { UpdateProfileHandler } from './commands/update-profile/update-profile.handler';
import { FindUserByEmailHandler } from './queries/find-user-by-email/find-user-by-email.handler';
import { GetProfileHandler } from './queries/get-profile/get-profile.handler';

// Owns user records. Other modules reach it only through the buses
// (CreateUserCommand, FindUserByEmailQuery), so nothing imports this module
// except AppModule, which registers its handlers.
@Module({
  providers: [
    CreateUserHandler,
    FindUserByEmailHandler,
    GetProfileHandler,
    UpdateProfileHandler,
  ],
})
export class UsersModule {}
