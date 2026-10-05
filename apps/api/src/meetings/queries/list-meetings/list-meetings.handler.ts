import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Meeting } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { visibleTo } from '../../meeting-access';
import { ListMeetingsQuery } from './list-meetings.query';

// Bound to the QueryBus by the decorator; reads only.
@QueryHandler(ListMeetingsQuery)
export class ListMeetingsHandler implements IQueryHandler<ListMeetingsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  execute({ user }: ListMeetingsQuery): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({
      where: visibleTo(user),
      orderBy: { date: 'asc' },
    });
  }
}
