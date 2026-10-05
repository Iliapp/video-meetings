import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Meeting } from '../generated/prisma/client';
import { CreateMeetingCommand } from './commands/create-meeting/create-meeting.command';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { GetMeetingQuery } from './queries/get-meeting/get-meeting.query';
import { ListMeetingsQuery } from './queries/list-meetings/list-meetings.query';

// CQRS: the controller holds no logic. It turns each request into a message,
// a command for a state change or a query for a read, and dispatches it on a
// bus; the matching handler does the work and its result becomes the response.
@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Write side: dispatch a command.
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() { title, date, participants }: CreateMeetingDto,
  ): Promise<Meeting> {
    return this.commandBus.execute(
      new CreateMeetingCommand(user.id, title, new Date(date), participants),
    );
  }

  // Read side: dispatch queries.
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<Meeting[]> {
    return this.queryBus.execute(new ListMeetingsQuery(user));
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Meeting> {
    return this.queryBus.execute(new GetMeetingQuery(user, id));
  }
}
