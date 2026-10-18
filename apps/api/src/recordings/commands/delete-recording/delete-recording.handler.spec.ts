import { Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecordingsStorageService } from '../../storage/recordings-storage.service';
import { DeleteRecordingCommand } from './delete-recording.command';
import { DeleteRecordingHandler } from './delete-recording.handler';

describe('DeleteRecordingHandler', () => {
  const recordingId = '3f9c2a52-4a49-4f0e-9e43-2b8f6f6d2c11';
  const command = new DeleteRecordingCommand('meeting-id', recordingId);
  const prisma = { recording: { delete: jest.fn() } };
  const storage = { remove: jest.fn() };
  let handler: DeleteRecordingHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeleteRecordingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RecordingsStorageService, useValue: storage },
      ],
    }).compile();
    handler = moduleRef.get(DeleteRecordingHandler);
  });

  it("deletes the meeting's row, then the file", async () => {
    const order: string[] = [];
    prisma.recording.delete.mockImplementation(() => {
      order.push('row');
      return Promise.resolve({ storageKey: 'storage-key' });
    });
    storage.remove.mockImplementation(() => {
      order.push('file');
      return Promise.resolve();
    });

    await expect(handler.execute(command)).resolves.toBeUndefined();
    expect(prisma.recording.delete).toHaveBeenCalledWith({
      where: { id: recordingId, meetingId: 'meeting-id' },
      select: { storageKey: true },
    });
    expect(storage.remove).toHaveBeenCalledWith('storage-key');
    expect(order).toEqual(['row', 'file']);
  });

  it('logs a failed file removal and still succeeds', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    prisma.recording.delete.mockResolvedValue({ storageKey: 'storage-key' });
    storage.remove.mockRejectedValue(new Error('EACCES'));

    await expect(handler.execute(command)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'Could not delete recording file storage-key',
      expect.any(Error),
    );
    log.mockRestore();
  });

  it('throws 404 when the recording is not in the meeting', async () => {
    prisma.recording.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(handler.execute(command)).rejects.toThrow(
      new NotFoundException('Recording not found'),
    );
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('throws 404 for a malformed id without querying', async () => {
    await expect(
      handler.execute(new DeleteRecordingCommand('meeting-id', 'nope')),
    ).rejects.toThrow('Recording not found');
    expect(prisma.recording.delete).not.toHaveBeenCalled();
  });

  it('passes on other database errors', async () => {
    prisma.recording.delete.mockRejectedValue(new Error('connection lost'));

    await expect(handler.execute(command)).rejects.toThrow('connection lost');
  });
});
