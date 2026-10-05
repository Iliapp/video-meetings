import { Query } from '@nestjs/cqrs';
import { AuthUser } from '../../../auth/auth-user';
import { Meeting } from '../../../generated/prisma/client';

// Query for a single meeting; carries the caller so the handler can check access.
export class GetMeetingQuery extends Query<Meeting> {
  constructor(
    readonly user: AuthUser,
    readonly id: string,
  ) {
    super();
  }
}
