import { UnsupportedMediaTypeException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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

  it('rejects an unsupported file with 415, deletes it and creates no row', async () => {
    detect.mockResolvedValue(undefined);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(storage.discard).toHaveBeenCalledWith(file.path);
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
});
