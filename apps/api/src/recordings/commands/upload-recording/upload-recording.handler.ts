import { UnsupportedMediaTypeException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  detectRecordingFormat,
  sanitizeFileName,
  UNSUPPORTED_FORMAT_MESSAGE,
} from '../../recording-file';
import {
  RecordingResponse,
  recordingWithUploader,
  toRecordingResponse,
} from '../../recording-response';
import { RecordingsStorageService } from '../../storage/recordings-storage.service';
import { UploadRecordingCommand } from './upload-recording.command';

// Validates the stored temp file, moves it into place, then creates the row.
// On any failure the file is deleted and no row is left.
@CommandHandler(UploadRecordingCommand)
export class UploadRecordingHandler implements ICommandHandler<UploadRecordingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: RecordingsStorageService,
  ) {}

  async execute({
    uploader,
    meetingId,
    file,
    durationSeconds,
  }: UploadRecordingCommand): Promise<RecordingResponse> {
    const format = await detectRecordingFormat(file.path, file.originalName);
    if (!format) {
      await this.storage.discard(file.path);
      throw new UnsupportedMediaTypeException(UNSUPPORTED_FORMAT_MESSAGE);
    }

    const storageKey = await this.storage.commit(file.path);
    try {
      const recording = await this.prisma.recording.create({
        data: {
          meetingId,
          uploaderId: uploader.id,
          originalName: sanitizeFileName(file.originalName),
          mimeType: format.mimeType,
          kind: format.kind,
          sizeBytes: file.size,
          durationSeconds,
          storageKey,
        },
        include: recordingWithUploader,
      });
      return toRecordingResponse(recording);
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }
}
