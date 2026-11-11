import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  ParseFilePipe,
  Patch,
  Put,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloseConnectionOnErrorFilter } from '../common/close-connection-on-error.filter';
import { AvatarUploadInterceptor } from './avatar-upload.interceptor';
import { avatarsConfig, type AvatarsConfig } from './avatars.config';
import { DeleteAvatarCommand } from './commands/delete-avatar/delete-avatar.command';
import { UpdateProfileCommand } from './commands/update-profile/update-profile.command';
import { UploadAvatarCommand } from './commands/upload-avatar/upload-avatar.command';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { type ProfileResponse, withAvatarBaseUrl } from './profile-response';
import { GetProfileQuery } from './queries/get-profile/get-profile.query';

// The signed-in user's own profile. Routes act only on @CurrentUser(), so
// there is no user id in the URL and nobody can reach another user's record.
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(avatarsConfig.KEY) private readonly config: AvatarsConfig,
  ) {}

  @Get()
  async getMe(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ): Promise<ProfileResponse> {
    return this.absolute(
      await this.queryBus.execute(new GetProfileQuery(user.id)),
      request,
    );
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() { name }: UpdateProfileDto,
    @Req() request: Request,
  ): Promise<ProfileResponse> {
    return this.absolute(
      await this.commandBus.execute(new UpdateProfileCommand(user.id, name)),
      request,
    );
  }

  // Order matters: guard (auth) → AvatarUploadInterceptor (size, cleanup) →
  // FileInterceptor (streams the file to disk) → pipes → handler.
  @Put('avatar')
  @UseFilters(CloseConnectionOnErrorFilter)
  @UseInterceptors(AvatarUploadInterceptor, FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile(new ParseFilePipe()) file: Express.Multer.File,
    @Req() request: Request,
  ): Promise<ProfileResponse> {
    return this.absolute(
      await this.commandBus.execute(
        new UploadAvatarCommand(user.id, {
          path: file.path,
          originalName: file.originalname,
        }),
      ),
      request,
    );
  }

  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAvatar(@CurrentUser() user: AuthUser): Promise<void> {
    return this.commandBus.execute(new DeleteAvatarCommand(user.id));
  }

  // Behind a proxy, set API_PUBLIC_URL: request.protocol and Host are what the
  // proxy sent, not what the browser used.
  private absolute(
    profile: ProfileResponse,
    request: Request,
  ): ProfileResponse {
    return withAvatarBaseUrl(
      profile,
      this.config.publicUrl ?? `${request.protocol}://${request.get('host')}`,
    );
  }
}
