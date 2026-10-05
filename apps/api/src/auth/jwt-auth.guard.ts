import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from './auth-user';

interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

// Verifies the `Authorization: Bearer <jwt>` header and puts the caller on `request.user`.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    try {
      const { sub, email } =
        await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = { id: sub, email };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
