import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileCommand } from './commands/update-profile/update-profile.command';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './profile';
import { GetProfileQuery } from './queries/get-profile/get-profile.query';

// Acts only on the caller from the token; there is no user id in the URL,
// so nobody can read or change another user's profile.
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<Profile> {
    return this.queryBus.execute(new GetProfileQuery(user.id));
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body() { name }: UpdateProfileDto,
  ): Promise<Profile> {
    return this.commandBus.execute(new UpdateProfileCommand(user.id, name));
  }
}
