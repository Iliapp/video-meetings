import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { AuthUser } from '../auth/auth-user';

// The acting user of an MCP call, taken from the `req.auth` that the SDK
// transport forwards as `extra.authInfo`. Whatever authenticates `/mcp` must
// set `req.auth.extra.user` to an `AuthUser`; until then every call is refused.
export function mcpUser(extra: { authInfo?: AuthInfo }): AuthUser {
  const user = extra.authInfo?.extra?.user as AuthUser | undefined;
  if (!user?.id) {
    throw new Error('Authentication required');
  }
  return user;
}
