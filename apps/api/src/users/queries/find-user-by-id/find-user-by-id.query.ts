import { Query } from '@nestjs/cqrs';
import { User } from '../../../generated/prisma/client';

export class FindUserByIdQuery extends Query<User | null> {
  constructor(readonly userId: string) {
    super();
  }
}
