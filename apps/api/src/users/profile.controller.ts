import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileCommand } from './commands/update-profile/update-profile.command';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { ProfileResponse } from './profile-response';
import { GetProfileQuery } from './queries/get-profile/get-profile.query';

// The signed-in user's own profile. Routes act only on @CurrentUser(), so
// there is no user id in the URL and nobody can reach another user's record.
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser): Promise<ProfileResponse> {
    return this.queryBus.execute(new GetProfileQuery(user.id));
  }

  @Patch()
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() { name }: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.commandBus.execute(new UpdateProfileCommand(user.id, name));
  }
}
