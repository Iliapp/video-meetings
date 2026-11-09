import { ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';

export interface McpRequester {
  userId: string;
}

export type McpRequest = AuthenticatedRequest & {
  requester?: McpRequester;
  auth?: AuthInfo;
};

// Authenticates `/mcp` exactly like the rest of the api (`JwtAuthGuard`:
// Bearer JWT, else `401`), then adds the MCP fields: `req.requester =
// { userId }`, and `req.auth`, which the MCP SDK forwards to tools and
// resources as `extra.authInfo` (read with `mcpUser`).
@Injectable()
export class McpAuthGuard extends JwtAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context.switchToHttp().getRequest<McpRequest>();
    const token = req.headers.authorization!.slice('Bearer '.length);
    req.requester = { userId: req.user.id };
    req.auth = {
      token,
      clientId: 'api',
      scopes: [],
      extra: { user: req.user },
    };
    return true;
  }
}
