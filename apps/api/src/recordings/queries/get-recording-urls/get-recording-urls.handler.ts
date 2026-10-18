import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { GetMeetingQuery } from '../../../meetings/queries/get-meeting/get-meeting.query';
import { PrismaService } from '../../../prisma/prisma.service';
import { recordingNotFound } from '../../recording-response';
import {
  RecordingUrlPurpose,
  RecordingUrlSigner,
} from '../../recording-url-signer';
import {
  recordingsConfig,
  type RecordingsConfig,
} from '../../recordings.config';
import {
  GetRecordingUrlsQuery,
  RecordingUrls,
} from './get-recording-urls.query';

@QueryHandler(GetRecordingUrlsQuery)
export class GetRecordingUrlsHandler implements IQueryHandler<GetRecordingUrlsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
    private readonly signer: RecordingUrlSigner,
    @Inject(recordingsConfig.KEY) private readonly config: RecordingsConfig,
  ) {}

  // The owner and invited participants get URLs. GetMeetingQuery answers 404
  // for everyone else; a recording that isn't in this meeting is 404 too.
  async execute({
    user,
    meetingId,
    recordingId,
    baseUrl,
  }: GetRecordingUrlsQuery): Promise<RecordingUrls> {
    await this.queryBus.execute(new GetMeetingQuery(user, meetingId));
    const recording = isUUID(recordingId)
      ? await this.prisma.recording.findFirst({
          where: { id: recordingId, meetingId },
          select: { id: true },
        })
      : null;
    if (!recording) {
      throw recordingNotFound();
    }

    const now = Date.now();
    const base = this.config.publicUrl ?? baseUrl;
    const urlFor = (purpose: RecordingUrlPurpose) => {
      const { token, expiresAt } = this.signer.sign(recording.id, purpose, now);
      // Concatenated, so a path prefix in API_PUBLIC_URL is kept.
      const url = new URL(`${base}/recordings/${recording.id}/${purpose}`);
      url.searchParams.set('token', token);
      return { url: url.toString(), expiresAt };
    };
    const stream = urlFor('stream');
    const download = urlFor('download');
    return {
      streamUrl: stream.url,
      downloadUrl: download.url,
      expiresAt: stream.expiresAt,
    };
  }
}
