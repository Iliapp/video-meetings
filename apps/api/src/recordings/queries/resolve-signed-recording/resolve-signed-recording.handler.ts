import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { recordingNotFound } from '../../recording-response';
import { RecordingUrlSigner } from '../../recording-url-signer';
import { RecordingsStorageService } from '../../storage/recordings-storage.service';
import {
  ResolveSignedRecordingQuery,
  SignedRecordingFile,
} from './resolve-signed-recording.query';

@QueryHandler(ResolveSignedRecordingQuery)
export class ResolveSignedRecordingHandler implements IQueryHandler<ResolveSignedRecordingQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: RecordingUrlSigner,
    private readonly storage: RecordingsStorageService,
  ) {}

  // A missing, expired, tampered or other recording's token, and a recording
  // deleted after the URL was issued, all answer 404.
  async execute({
    recordingId,
    token,
    purpose,
  }: ResolveSignedRecordingQuery): Promise<SignedRecordingFile> {
    if (!this.signer.verify(token, recordingId, purpose)) {
      throw recordingNotFound();
    }
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      select: { storageKey: true, mimeType: true, originalName: true },
    });
    if (!recording) {
      throw recordingNotFound();
    }
    return {
      path: this.storage.pathFor(recording.storageKey),
      mimeType: recording.mimeType,
      originalName: recording.originalName,
    };
  }
}
