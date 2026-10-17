import { Query } from '@nestjs/cqrs';
import { AuthUser } from '../../../auth/auth-user';
import { RecordingResponse } from '../../recording-response';

// Recordings of one meeting; carries the caller so the handler can check access.
export class ListRecordingsQuery extends Query<RecordingResponse[]> {
  constructor(
    readonly user: AuthUser,
    readonly meetingId: string,
  ) {
    super();
  }
}
