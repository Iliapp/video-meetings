import {
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '../../../generated/prisma/client';
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
// A rejected temp file is deleted by RecordingUploadInterceptor; a committed
// file is deleted here if the row can't be created.
@CommandHandler(UploadRecordingCommand)
export class UploadRecordingHandler implements ICommandHandler<UploadRecordingCommand> {
  private readonly logger = new Logger(UploadRecordingHandler.name);

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
      await this.storage.remove(storageKey).catch((removeError: unknown) => {
        this.logger.error(
          `Could not delete recording file ${storageKey}`,
          removeError,
        );
      });
      // The meeting or the uploader was deleted while the file was uploading.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Meeting not found');
      }
      throw error;
    }
  }
}
