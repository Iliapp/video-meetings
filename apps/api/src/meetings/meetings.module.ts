import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreateMeetingHandler } from './commands/create-meeting/create-meeting.handler';
import { MeetingsController } from './meetings.controller';
import { GetMeetingHandler } from './queries/get-meeting/get-meeting.handler';
import { ListMeetingsHandler } from './queries/list-meetings/list-meetings.handler';

@Module({
  imports: [AuthModule],
  controllers: [MeetingsController],
  // Handlers are plain providers: CqrsModule (registered in AppModule) finds
  // them by their @CommandHandler/@QueryHandler decorators and subscribes them
  // to the buses. A command or query without a registered handler fails at runtime.
  providers: [CreateMeetingHandler, ListMeetingsHandler, GetMeetingHandler],
})
export class MeetingsModule {}
