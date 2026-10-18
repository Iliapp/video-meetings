import { Command } from '@nestjs/cqrs';

// The caller's access (meeting owner) is checked by MeetingOwnerGuard.
export class DeleteRecordingCommand extends Command<void> {
  constructor(
    readonly meetingId: string,
    readonly recordingId: string,
  ) {
    super();
  }
}
