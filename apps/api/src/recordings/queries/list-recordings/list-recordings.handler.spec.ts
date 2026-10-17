import { NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { GetMeetingQuery } from '../../../meetings/queries/get-meeting/get-meeting.query';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListRecordingsHandler } from './list-recordings.handler';
import { ListRecordingsQuery } from './list-recordings.query';

describe('ListRecordingsHandler', () => {
  const user = { id: 'user-id', email: 'guest@example.com' };
  const queryBus = { execute: jest.fn() };
  const prisma = { recording: { findMany: jest.fn() } };
  let handler: ListRecordingsHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ListRecordingsHandler,
        { provide: QueryBus, useValue: queryBus },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(ListRecordingsHandler);
  });

  it("checks access, then returns the meeting's recordings newest first", async () => {
    const createdAt = new Date();
    queryBus.execute.mockResolvedValue({ id: 'meeting-id' });
    prisma.recording.findMany.mockResolvedValue([
      {
        id: 'recording-id',
        meetingId: 'meeting-id',
        originalName: 'call.mp4',
        mimeType: 'video/mp4',
        kind: 'video',
        sizeBytes: BigInt(3_000_000_000),
        durationSeconds: null,
        storageKey: 'storage-key',
        createdAt,
        uploader: { email: 'owner@example.com' },
      },
    ]);

    await expect(
      handler.execute(new ListRecordingsQuery(user, 'meeting-id')),
    ).resolves.toEqual([
      {
        id: 'recording-id',
        meetingId: 'meeting-id',
        originalName: 'call.mp4',
        mimeType: 'video/mp4',
        kind: 'video',
        sizeBytes: 3_000_000_000,
        durationSeconds: null,
        createdAt,
        uploaderEmail: 'owner@example.com',
      },
    ]);
    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetMeetingQuery(user, 'meeting-id'),
    );
    expect(prisma.recording.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { meetingId: 'meeting-id' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('does not read recordings when the meeting is not visible', async () => {
    queryBus.execute.mockRejectedValue(
      new NotFoundException('Meeting not found'),
    );

    await expect(
      handler.execute(new ListRecordingsQuery(user, 'meeting-id')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.recording.findMany).not.toHaveBeenCalled();
  });
});
