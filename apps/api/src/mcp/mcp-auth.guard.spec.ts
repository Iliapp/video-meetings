import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { McpAuthGuard, McpRequest } from './mcp-auth.guard';

describe('McpAuthGuard', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const guard = new McpAuthGuard(jwt);

  const run = (authorization?: string) => {
    const req = { headers: { authorization } } as McpRequest;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { req, result: guard.canActivate(ctx) };
  };

  it('sets req.requester from a valid token', async () => {
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.c' });
    const { req, result } = run(`Bearer ${token}`);
    await expect(result).resolves.toBe(true);
    expect(req.requester).toEqual({ userId: 'u1' });
    expect(req.auth?.extra?.user).toEqual({ id: 'u1', email: 'a@b.c' });
  });

  it.each([undefined, 'Bearer', 'Basic abc', 'Bearer not-a-jwt'])(
    'rejects %p with 401',
    async (header) => {
      await expect(run(header).result).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it('rejects a token signed with another secret', async () => {
    const other = new JwtService({ secret: 'other' });
    const token = await other.signAsync({ sub: 'u1', email: 'a@b.c' });
    await expect(run(`Bearer ${token}`).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token without sub', async () => {
    const token = await jwt.signAsync({ email: 'a@b.c' });
    await expect(run(`Bearer ${token}`).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
