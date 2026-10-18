import { Query } from '@nestjs/cqrs';
import { RecordingUrlPurpose } from '../../recording-url-signer';

// What the stream and download endpoints need to send the file.
export interface SignedRecordingFile {
  path: string;
  mimeType: string;
  originalName: string;
}

// Checks a signed URL token instead of a Bearer token: the URL is opened by
// <video>, <audio> or a plain link.
export class ResolveSignedRecordingQuery extends Query<SignedRecordingFile> {
  constructor(
    readonly recordingId: string,
    readonly token: string,
    readonly purpose: RecordingUrlPurpose,
  ) {
    super();
  }
}
