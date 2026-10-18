import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecordingUrlSigner } from '../../recording-url-signer';
import { RecordingsStorageService } from '../../storage/recordings-storage.service';
import { ResolveSignedRecordingHandler } from './resolve-signed-recording.handler';
import { ResolveSignedRecordingQuery } from './resolve-signed-recording.query';

describe('ResolveSignedRecordingHandler', () => {
  const query = new ResolveSignedRecordingQuery(
    'recording-id',
    'token',
    'download',
  );
  const prisma = { recording: { findUnique: jest.fn() } };
  const signer = { verify: jest.fn() };
  const storage = { pathFor: jest.fn() };
  let handler: ResolveSignedRecordingHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveSignedRecordingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RecordingUrlSigner, useValue: signer },
        { provide: RecordingsStorageService, useValue: storage },
      ],
    }).compile();
    handler = moduleRef.get(ResolveSignedRecordingHandler);
  });

  it('returns the file for a valid token', async () => {
    signer.verify.mockReturnValue(true);
    prisma.recording.findUnique.mockResolvedValue({
      storageKey: 'storage-key',
      mimeType: 'audio/mpeg',
      originalName: 'Зустріч.mp3',
    });
    storage.pathFor.mockReturnValue('/recordings/storage-key');

    await expect(handler.execute(query)).resolves.toEqual({
      path: '/recordings/storage-key',
      mimeType: 'audio/mpeg',
      originalName: 'Зустріч.mp3',
    });
    expect(signer.verify).toHaveBeenCalledWith(
      'token',
      'recording-id',
      'download',
    );
    expect(storage.pathFor).toHaveBeenCalledWith('storage-key');
  });

  it('throws 404 for an invalid token without loading the recording', async () => {
    signer.verify.mockReturnValue(false);

    await expect(handler.execute(query)).rejects.toThrow(
      new NotFoundException('Recording not found'),
    );
    expect(prisma.recording.findUnique).not.toHaveBeenCalled();
  });

  it('throws 404 when the recording was deleted after the URL was issued', async () => {
    signer.verify.mockReturnValue(true);
    prisma.recording.findUnique.mockResolvedValue(null);

    await expect(handler.execute(query)).rejects.toThrow('Recording not found');
  });
});
