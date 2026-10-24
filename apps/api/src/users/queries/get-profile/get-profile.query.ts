import { Query } from '@nestjs/cqrs';
import { ProfileResponse } from '../../profile-response';

// Throws NotFoundException when the user no longer exists.
export class GetProfileQuery extends Query<ProfileResponse> {
  constructor(readonly userId: string) {
    super();
  }
}
