import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { GetMeetingQuery } from '../meetings/queries/get-meeting/get-meeting.query';

// Use after JwtAuthGuard on routes under /meetings/:id. A guard runs before
// interceptors, so an upload is rejected before multer reads any of the body.
// Not visible → 404 (from GetMeetingQuery); visible but not owned → 403.
@Injectable()
export class MeetingOwnerGuard implements CanActivate {
  constructor(private readonly queryBus: QueryBus) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const meeting = await this.queryBus.execute(
      new GetMeetingQuery(request.user, String(request.params.id)),
    );
    if (meeting.ownerId !== request.user.id) {
      throw new ForbiddenException(
        'Only the meeting owner can upload recordings',
      );
    }
    return true;
  }
}
