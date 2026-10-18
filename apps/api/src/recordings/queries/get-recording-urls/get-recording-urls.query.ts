import { Query } from '@nestjs/cqrs';
import { AuthUser } from '../../../auth/auth-user';

export interface RecordingUrls {
  streamUrl: string;
  downloadUrl: string;
  expiresAt: Date;
}

// Signed stream and download URLs for one recording. `baseUrl` is the api's
// public origin; the handler uses it unless API_PUBLIC_URL is set.
export class GetRecordingUrlsQuery extends Query<RecordingUrls> {
  constructor(
    readonly user: AuthUser,
    readonly meetingId: string,
    readonly recordingId: string,
    readonly baseUrl: string,
  ) {
    super();
  }
}
