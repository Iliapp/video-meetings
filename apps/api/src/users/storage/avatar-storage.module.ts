import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { avatarsConfig } from '../avatars.config';
import { AvatarStorageService } from './avatar-storage.service';

// A module of its own so MulterModule.registerAsync can import the storage
// (for the incoming directory) and the avatars config (for the size limit).
@Module({
  imports: [ConfigModule.forFeature(avatarsConfig)],
  providers: [AvatarStorageService],
  exports: [ConfigModule, AvatarStorageService],
})
export class AvatarStorageModule {}
