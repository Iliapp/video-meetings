import { Query } from '@nestjs/cqrs';
import { Profile } from '../../profile';

// Throws NotFoundException when the user no longer exists.
export class GetProfileQuery extends Query<Profile> {
  constructor(readonly userId: string) {
    super();
  }
}
