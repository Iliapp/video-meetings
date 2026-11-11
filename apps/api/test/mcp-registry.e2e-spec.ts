import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  INestApplication,
  Injectable,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { McpController } from './../src/mcp/mcp.controller';
import { McpAuthGuard } from './../src/mcp/mcp-auth.guard';
import { McpRegistrar, McpRegistry } from './../src/mcp/mcp-registry';
import { McpRegistryModule } from './../src/mcp/mcp-registry.module';
import { McpService } from './../src/mcp/mcp.service';

// A stand-in domain: it registers itself like `TaskTools` does.
@Injectable()
class PingTools implements McpRegistrar, OnModuleInit {
  constructor(private readonly registry: McpRegistry) {}

  onModuleInit() {
    this.registry.add(this);
  }

  register(server: McpServer) {
    server.registerTool('ping', { description: 'Answers pong' }, () => ({
      content: [{ type: 'text', text: 'pong' }],
    }));
  }
}

@Module({ imports: [McpRegistryModule], providers: [PingTools] })
class PingModule {}

// Same shape as `McpModule`: the domain module is imported, so its registrar
// is in the registry before `McpService.onModuleInit` reads it.
@Module({
  imports: [McpRegistryModule, PingModule],
  controllers: [McpController],
  providers: [McpService],
})
class TestMcpModule {}

describe('MCP registry (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestMcpModule],
    })
      // Authentication is covered by `mcp.e2e-spec.ts`; this is about wiring.
      .overrideGuard(McpAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const rpc = (method: string, params: object = {}) =>
    request(app.getHttpServer())
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method, params })
      .expect(200);

  it('registers the tools of every domain that announced itself', async () => {
    const res = await rpc('tools/list');
    const tools = (res.body as { result: { tools: { name: string }[] } }).result
      .tools;
    expect(tools.map((t) => t.name)).toEqual(['ping']);
  });

  it('calls a registered tool', async () => {
    const res = await rpc('tools/call', { name: 'ping', arguments: {} });
    expect(
      (res.body as { result: { content: { text: string }[] } }).result
        .content[0].text,
    ).toBe('pong');
  });
});
