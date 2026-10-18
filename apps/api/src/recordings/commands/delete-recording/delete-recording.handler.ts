import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { recordingNotFound } from '../../recording-response';
import { RecordingsStorageService } from '../../storage/recordings-storage.service';
import { DeleteRecordingCommand } from './delete-recording.command';

// Deletes the row first, so the recording and its signed URLs are gone for
// users even if the file can't be removed; that failure is only logged.
@CommandHandler(DeleteRecordingCommand)
export class DeleteRecordingHandler implements ICommandHandler<DeleteRecordingCommand> {
  private readonly logger = new Logger(DeleteRecordingHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: RecordingsStorageService,
  ) {}

  async execute({
    meetingId,
    recordingId,
  }: DeleteRecordingCommand): Promise<void> {
    if (!isUUID(recordingId)) {
      throw recordingNotFound();
    }
    let storageKey: string;
    try {
      ({ storageKey } = await this.prisma.recording.delete({
        where: { id: recordingId, meetingId },
        select: { storageKey: true },
      }));
    } catch (error) {
      // No such recording in this meeting (or deleted concurrently).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw recordingNotFound();
      }
      throw error;
    }

    await this.storage.remove(storageKey).catch((removeError: unknown) => {
      this.logger.error(
        `Could not delete recording file ${storageKey}`,
        removeError,
      );
    });
  }
}
