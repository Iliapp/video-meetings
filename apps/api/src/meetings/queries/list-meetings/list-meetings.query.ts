import { Query } from '@nestjs/cqrs';
import { AuthUser } from '../../../auth/auth-user';
import { Meeting } from '../../../generated/prisma/client';

// Query: a read-only request; its handler must not change state.
// The generic in Query<Meeting[]> types what queryBus.execute() returns.
export class ListMeetingsQuery extends Query<Meeting[]> {
  constructor(readonly user: AuthUser) {
    super();
  }
}
