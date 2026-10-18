import { NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { GetMeetingQuery } from '../../../meetings/queries/get-meeting/get-meeting.query';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecordingUrlSigner } from '../../recording-url-signer';
import { recordingsConfig } from '../../recordings.config';
import { GetRecordingUrlsHandler } from './get-recording-urls.handler';
import { GetRecordingUrlsQuery } from './get-recording-urls.query';

describe('GetRecordingUrlsHandler', () => {
  const user = { id: 'user-id', email: 'guest@example.com' };
  const recordingId = '3f9c2a52-4a49-4f0e-9e43-2b8f6f6d2c11';
  const expiresAt = new Date('2026-10-18T18:00:00.000Z');
  const queryBus = { execute: jest.fn() };
  const prisma = { recording: { findFirst: jest.fn() } };
  const signer = { sign: jest.fn() };
  let config: { publicUrl: string | undefined };
  let handler: GetRecordingUrlsHandler;

  const query = (id = recordingId) =>
    new GetRecordingUrlsQuery(user, 'meeting-id', id, 'http://localhost:4000');

  beforeEach(async () => {
    jest.resetAllMocks();
    config = { publicUrl: undefined };
    signer.sign.mockImplementation((_id: string, purpose: string) => ({
      token: `${purpose}-token`,
      expiresAt,
    }));
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRecordingUrlsHandler,
        { provide: QueryBus, useValue: queryBus },
        { provide: PrismaService, useValue: prisma },
        { provide: RecordingUrlSigner, useValue: signer },
        { provide: recordingsConfig.KEY, useValue: config },
      ],
    }).compile();
    handler = moduleRef.get(GetRecordingUrlsHandler);
  });

  it("checks access, then signs URLs for the meeting's recording", async () => {
    queryBus.execute.mockResolvedValue({ id: 'meeting-id' });
    prisma.recording.findFirst.mockResolvedValue({ id: recordingId });

    await expect(handler.execute(query())).resolves.toEqual({
      streamUrl: `http://localhost:4000/recordings/${recordingId}/stream?token=stream-token`,
      downloadUrl: `http://localhost:4000/recordings/${recordingId}/download?token=download-token`,
      expiresAt,
    });
    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetMeetingQuery(user, 'meeting-id'),
    );
    expect(prisma.recording.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: recordingId, meetingId: 'meeting-id' },
      }),
    );
  });

  it('builds the URLs on API_PUBLIC_URL when it is set', async () => {
    config.publicUrl = 'https://example.com/api';
    queryBus.execute.mockResolvedValue({ id: 'meeting-id' });
    prisma.recording.findFirst.mockResolvedValue({ id: recordingId });

    const { streamUrl } = await handler.execute(query());

    expect(streamUrl).toBe(
      `https://example.com/api/recordings/${recordingId}/stream?token=stream-token`,
    );
  });

  it('passes on the 404 when the caller cannot see the meeting', async () => {
    queryBus.execute.mockRejectedValue(
      new NotFoundException('Meeting not found'),
    );

    await expect(handler.execute(query())).rejects.toThrow('Meeting not found');
    expect(prisma.recording.findFirst).not.toHaveBeenCalled();
  });

  it('throws 404 when the recording is not in the meeting', async () => {
    queryBus.execute.mockResolvedValue({ id: 'meeting-id' });
    prisma.recording.findFirst.mockResolvedValue(null);

    await expect(handler.execute(query())).rejects.toThrow(
      new NotFoundException('Recording not found'),
    );
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('throws 404 for a malformed recording id without querying', async () => {
    queryBus.execute.mockResolvedValue({ id: 'meeting-id' });

    await expect(handler.execute(query('not-a-uuid'))).rejects.toThrow(
      'Recording not found',
    );
    expect(prisma.recording.findFirst).not.toHaveBeenCalled();
  });
});
