import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloseConnectionOnErrorFilter } from './close-connection-on-error.filter';
import { UploadRecordingCommand } from './commands/upload-recording/upload-recording.command';
import { UploadRecordingDto } from './dto/upload-recording.dto';
import { MeetingOwnerGuard } from './meeting-owner.guard';
import { ListRecordingsQuery } from './queries/list-recordings/list-recordings.query';
import { RecordingResponse } from './recording-response';
import { RecordingUploadInterceptor } from './recording-upload.interceptor';

@Controller('meetings/:id/recordings')
@UseGuards(JwtAuthGuard)
export class RecordingsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Order matters: guards (auth, owner) → RecordingUploadInterceptor (size,
  // cleanup) → FileInterceptor (streams the file to disk) → pipes → handler.
  @Post()
  @UseGuards(MeetingOwnerGuard)
  @UseFilters(CloseConnectionOnErrorFilter)
  @UseInterceptors(RecordingUploadInterceptor, FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') meetingId: string,
    @UploadedFile(new ParseFilePipe()) file: Express.Multer.File,
    @Body() { durationSeconds }: UploadRecordingDto,
  ): Promise<RecordingResponse> {
    return this.commandBus.execute(
      new UploadRecordingCommand(
        user,
        meetingId,
        { path: file.path, originalName: file.originalname, size: file.size },
        durationSeconds ?? null,
      ),
    );
  }

  // Newest first.
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('id') meetingId: string,
  ): Promise<RecordingResponse[]> {
    return this.queryBus.execute(new ListRecordingsQuery(user, meetingId));
  }
}
