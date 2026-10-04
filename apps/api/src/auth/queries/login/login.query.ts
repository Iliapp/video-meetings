import { Query } from '@nestjs/cqrs';
import { AuthResponseDto } from '../../dto/auth-response.dto';

export class LoginQuery extends Query<AuthResponseDto> {
  constructor(
    readonly email: string,
    readonly password: string,
  ) {
    super();
  }
}
