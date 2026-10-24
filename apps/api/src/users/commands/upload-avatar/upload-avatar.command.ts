import { Command } from '@nestjs/cqrs';
import { ProfileResponse } from '../../profile-response';

// A file multer has already written to AVATARS_DIR/incoming.
export interface UploadedAvatarFile {
  path: string;
  originalName: string;
}

// Sets or replaces the user's avatar and returns the updated profile.
export class UploadAvatarCommand extends Command<ProfileResponse> {
  constructor(
    readonly userId: string,
    readonly file: UploadedAvatarFile,
  ) {
    super();
  }
}
