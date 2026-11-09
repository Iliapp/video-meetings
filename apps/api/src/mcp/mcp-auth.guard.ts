import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';

interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface McpRequester {
  userId: string;
}

export type McpRequest = Request & {
  requester?: McpRequester;
  auth?: AuthInfo;
};

// Authenticates `/mcp` with the same access tokens as the rest of the api
// (`Authorization: Bearer <jwt>`, verified by `JwtService`). Sets
// `req.requester = { userId }`, and `req.auth`, which the MCP SDK forwards to
// tools and resources as `extra.authInfo` (see `mcpUser`).
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<McpRequest>();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException();
    }

    const user: AuthUser = { id: payload.sub, email: payload.email };
    req.requester = { userId: payload.sub };
    req.auth = { token, clientId: 'api', scopes: [], extra: { user } };
    return true;
  }
}
