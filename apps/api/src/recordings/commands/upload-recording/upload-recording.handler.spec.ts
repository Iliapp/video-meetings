import {
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { detectRecordingFormat } from '../../recording-file';
import { RecordingsStorageService } from '../../storage/recordings-storage.service';
import { UploadRecordingCommand } from './upload-recording.command';
import { UploadRecordingHandler } from './upload-recording.handler';

jest.mock('../../recording-file', () => ({
  ...jest.requireActual<object>('../../recording-file'),
  detectRecordingFormat: jest.fn(),
}));

describe('UploadRecordingHandler', () => {
  const uploader = { id: 'user-id', email: 'owner@example.com' };
  const file = {
    path: '/recordings/incoming/temp',
    originalName: 'Зустріч.mp3',
    size: 4406,
  };
  const command = new UploadRecordingCommand(uploader, 'meeting-id', file, 61);
  const detect = jest.mocked(detectRecordingFormat);
  const prisma = { recording: { create: jest.fn() } };
  const storage = {
    commit: jest.fn(),
    remove: jest.fn(),
    discard: jest.fn(),
  };
  let handler: UploadRecordingHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    storage.remove.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadRecordingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RecordingsStorageService, useValue: storage },
      ],
    }).compile();
    handler = moduleRef.get(UploadRecordingHandler);
  });

  it('commits the file and creates the row with the detected format', async () => {
    const createdAt = new Date();
    detect.mockResolvedValue({ mimeType: 'audio/mpeg', kind: 'audio' });
    storage.commit.mockResolvedValue('storage-key');
    prisma.recording.create.mockResolvedValue({
      id: 'recording-id',
      meetingId: 'meeting-id',
      originalName: file.originalName,
      mimeType: 'audio/mpeg',
      kind: 'audio',
      sizeBytes: BigInt(file.size),
      durationSeconds: 61,
      storageKey: 'storage-key',
      createdAt,
      uploader: { email: uploader.email },
    });

    await expect(handler.execute(command)).resolves.toEqual({
      id: 'recording-id',
      meetingId: 'meeting-id',
      originalName: file.originalName,
      mimeType: 'audio/mpeg',
      kind: 'audio',
      sizeBytes: file.size,
      durationSeconds: 61,
      createdAt,
      uploaderEmail: uploader.email,
    });
    expect(detect).toHaveBeenCalledWith(file.path, file.originalName);
    expect(storage.commit).toHaveBeenCalledWith(file.path);
    expect(prisma.recording.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          meetingId: 'meeting-id',
          uploaderId: uploader.id,
          originalName: file.originalName,
          mimeType: 'audio/mpeg',
          kind: 'audio',
          sizeBytes: file.size,
          durationSeconds: 61,
          storageKey: 'storage-key',
        },
      }),
    );
  });

  // The temp file itself is deleted by RecordingUploadInterceptor.
  it('rejects an unsupported file with 415 and creates no row', async () => {
    detect.mockResolvedValue(undefined);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(storage.commit).not.toHaveBeenCalled();
    expect(prisma.recording.create).not.toHaveBeenCalled();
  });

  it('removes the committed file when the row cannot be created', async () => {
    const error = new Error('database is down');
    detect.mockResolvedValue({ mimeType: 'audio/mpeg', kind: 'audio' });
    storage.commit.mockResolvedValue('storage-key');
    prisma.recording.create.mockRejectedValue(error);

    await expect(handler.execute(command)).rejects.toBe(error);
    expect(storage.remove).toHaveBeenCalledWith('storage-key');
  });

  it('keeps the original error when the committed file cannot be removed', async () => {
    const error = new Error('database is down');
    detect.mockResolvedValue({ mimeType: 'audio/mpeg', kind: 'audio' });
    storage.commit.mockResolvedValue('storage-key');
    storage.remove.mockRejectedValue(new Error('EACCES'));
    prisma.recording.create.mockRejectedValue(error);

    await expect(handler.execute(command)).rejects.toBe(error);
  });

  it('answers 404 when the meeting was deleted during the upload', async () => {
    detect.mockResolvedValue({ mimeType: 'audio/mpeg', kind: 'audio' });
    storage.commit.mockResolvedValue('storage-key');
    prisma.recording.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key violated', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.remove).toHaveBeenCalledWith('storage-key');
  });
});
