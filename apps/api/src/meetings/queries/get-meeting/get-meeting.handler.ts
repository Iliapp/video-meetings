import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { Meeting } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { visibleTo } from '../../meeting-access';
import { GetMeetingQuery } from './get-meeting.query';

// Bound to the QueryBus by the decorator. Errors thrown here (NotFoundException)
// propagate through queryBus.execute() to Nest's exception filter as usual.
@QueryHandler(GetMeetingQuery)
export class GetMeetingHandler implements IQueryHandler<GetMeetingQuery> {
  constructor(private readonly prisma: PrismaService) {}

  // Malformed ids and meetings the user can't see both answer 404, so the
  // response never reveals that someone else's meeting exists.
  async execute({ user, id }: GetMeetingQuery): Promise<Meeting> {
    const meeting = isUUID(id)
      ? await this.prisma.meeting.findFirst({
          where: { id, ...visibleTo(user) },
        })
      : null;
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }
}
