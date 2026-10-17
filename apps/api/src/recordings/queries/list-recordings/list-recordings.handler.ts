import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { GetMeetingQuery } from '../../../meetings/queries/get-meeting/get-meeting.query';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  RecordingResponse,
  recordingWithUploader,
  toRecordingResponse,
} from '../../recording-response';
import { ListRecordingsQuery } from './list-recordings.query';

@QueryHandler(ListRecordingsQuery)
export class ListRecordingsHandler implements IQueryHandler<ListRecordingsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
  ) {}

  // The owner and invited participants can list. GetMeetingQuery answers 404
  // for everyone else, the same as for an unknown meeting.
  async execute({
    user,
    meetingId,
  }: ListRecordingsQuery): Promise<RecordingResponse[]> {
    await this.queryBus.execute(new GetMeetingQuery(user, meetingId));
    const recordings = await this.prisma.recording.findMany({
      where: { meetingId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: recordingWithUploader,
    });
    return recordings.map(toRecordingResponse);
  }
}
