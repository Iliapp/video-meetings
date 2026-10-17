import { Command } from '@nestjs/cqrs';
import { AuthUser } from '../../../auth/auth-user';
import { RecordingResponse } from '../../recording-response';

// A file multer has already written to RECORDINGS_DIR/incoming.
export interface UploadedRecordingFile {
  path: string;
  originalName: string;
  size: number;
}

// The caller's access (meeting owner) is checked by MeetingOwnerGuard before
// the file is received.
export class UploadRecordingCommand extends Command<RecordingResponse> {
  constructor(
    readonly uploader: AuthUser,
    readonly meetingId: string,
    readonly file: UploadedRecordingFile,
    readonly durationSeconds: number | null,
  ) {
    super();
  }
}
