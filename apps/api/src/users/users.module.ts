import { randomUUID } from 'node:crypto';
import { Module, UnsupportedMediaTypeException } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AuthModule } from '../auth/auth.module';
import { AvatarFilesController } from './avatar-files.controller';
import {
  hasAllowedAvatarExtension,
  UNSUPPORTED_AVATAR_MESSAGE,
} from './avatar-file';
import { AvatarUploadInterceptor } from './avatar-upload.interceptor';
import { avatarsConfig, type AvatarsConfig } from './avatars.config';
import { CreateUserHandler } from './commands/create-user/create-user.handler';
import { DeleteAvatarHandler } from './commands/delete-avatar/delete-avatar.handler';
import { UpdateProfileHandler } from './commands/update-profile/update-profile.handler';
import { UploadAvatarHandler } from './commands/upload-avatar/upload-avatar.handler';
import { ProfileController } from './profile.controller';
import { FindUserByEmailHandler } from './queries/find-user-by-email/find-user-by-email.handler';
import { GetProfileHandler } from './queries/get-profile/get-profile.handler';
import { ResolveAvatarHandler } from './queries/resolve-avatar/resolve-avatar.handler';
import { AvatarStorageModule } from './storage/avatar-storage.module';
import { AvatarStorageService } from './storage/avatar-storage.service';

// Owns user records. Other modules reach it only through the buses
// (CreateUserCommand, FindUserByEmailQuery), so nothing imports this module
// except AppModule, which registers its handlers and ProfileController.
@Module({
  imports: [
    AuthModule,
    AvatarStorageModule,
    // Avatar uploads stream to AVATARS_DIR/incoming under a random name;
    // multer deletes the partial file itself when the request is aborted or a
    // limit is hit.
    MulterModule.registerAsync({
      imports: [AvatarStorageModule],
      inject: [avatarsConfig.KEY, AvatarStorageService],
      useFactory: (config: AvatarsConfig, storage: AvatarStorageService) => ({
        storage: diskStorage({
          destination: storage.incomingDir,
          filename: (_req, _file, cb) => cb(null, randomUUID()),
        }),
        limits: { fileSize: config.maxBytes, files: 1, fields: 5, parts: 6 },
        defParamCharset: 'utf8',
        fileFilter: (_req, file, cb) =>
          hasAllowedAvatarExtension(file.originalname)
            ? cb(null, true)
            : cb(
                new UnsupportedMediaTypeException(UNSUPPORTED_AVATAR_MESSAGE),
                false,
              ),
      }),
    }),
  ],
  controllers: [ProfileController, AvatarFilesController],
  providers: [
    CreateUserHandler,
    FindUserByEmailHandler,
    GetProfileHandler,
    ResolveAvatarHandler,
    UpdateProfileHandler,
    UploadAvatarHandler,
    DeleteAvatarHandler,
    AvatarUploadInterceptor,
  ],
})
export class UsersModule {}
