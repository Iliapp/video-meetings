import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Only the fields these tests read; which ones are set depends on the method.
interface RpcResult {
  isError?: boolean;
  content: { text: string }[];
  contents: { uri: string; mimeType?: string; text: string }[];
  tools: { name: string; annotations?: { readOnlyHint?: boolean } }[];
  resources: { uri: string; mimeType?: string }[];
  resourceTemplates: { uriTemplate: string }[];
  serverInfo: { name: string };
}

interface Row {
  id: string;
  title: string;
  status: string;
}

interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result: RpcResult;
  error?: { message: string };
}

describe('MCP (e2e)', () => {
  let app: INestApplication<App>;
  let nextId = 1;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    defaultToken = await signUp();
  });

  afterAll(async () => {
    await app.close();
  });

  const signUp = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `user-${randomUUID()}@example.com`,
        password: 'Str0ngPassw0rd!',
      })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  };

  // Calls that don't care who they are use this user's token.
  let defaultToken: string;

  const rpc = async (
    method: string,
    params: object = {},
    token: string = defaultToken,
  ): Promise<RpcResponse> => {
    const req = request(app.getHttpServer())
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream');
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req
      .send({ jsonrpc: '2.0', id: nextId++, method, params })
      .expect(200);
    return res.body as RpcResponse;
  };

  const callTool = (name: string, args: object, token?: string) =>
    rpc('tools/call', { name, arguments: args }, token);

  const toolJson = <T = Row>(res: RpcResponse): T =>
    JSON.parse(res.result.content[0].text) as T;
  const resourceJson = <T = Row>(res: RpcResponse): T =>
    JSON.parse(res.result.contents[0].text) as T;

  it('answers initialize with a JSON response', async () => {
    const res = await rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '1.0.0' },
    });
    expect(res.result.serverInfo.name).toBe('video-meetings-api');
  });

  it('serves several requests in a row', async () => {
    const first = await rpc('tools/list');
    const second = await rpc('tools/list');
    const names = (r: RpcResponse) =>
      (r.result.tools as { name: string }[]).map((t) => t.name).sort();
    expect(names(first)).toEqual(['find_tasks', 'upsert_task']);
    expect(names(second)).toEqual(names(first));
  });

  it('lists the task resources', async () => {
    const list = await rpc('resources/list');
    expect(list.result.resources.map((r: { uri: string }) => r.uri)).toContain(
      'tasks://open',
    );
    const templates = await rpc('resources/templates/list');
    expect(templates.result.resourceTemplates[0].uriTemplate).toBe(
      'task://{id}',
    );
  });

  it.each([undefined, 'Bearer', 'Bearer not-a-jwt', 'Basic abc'])(
    'answers 401 without a valid Bearer token (%p)',
    async (header) => {
      const req = request(app.getHttpServer())
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream');
      if (header) req.set('Authorization', header);
      await req
        .send({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })
        .expect(401);
    },
  );

  it('upserts tasks and reads them back through the resources', async () => {
    const token = await signUp();
    const created = toolJson(
      await callTool(
        'upsert_task',
        { title: 'Write notes', status: 'TODO' },
        token,
      ),
    );
    expect(created).toMatchObject({ title: 'Write notes', status: 'TODO' });

    const updated = toolJson(
      await callTool(
        'upsert_task',
        { title: 'Write notes', status: 'IN_PROGRESS' },
        token,
      ),
    );
    expect(updated.id).toBe(created.id);
    expect(updated.status).toBe('IN_PROGRESS');

    const open = await rpc('resources/read', { uri: 'tasks://open' }, token);
    expect(resourceJson(open)).toHaveLength(1);

    const one = await rpc(
      'resources/read',
      { uri: `task://${created.id}` },
      token,
    );
    expect(resourceJson(one).title).toBe('Write notes');

    await callTool(
      'upsert_task',
      { title: 'Write notes', status: 'DONE' },
      token,
    );
    const afterDone = await rpc(
      'resources/read',
      { uri: 'tasks://open' },
      token,
    );
    expect(resourceJson(afterDone)).toEqual([]);
  });

  it("does not show another user's task", async () => {
    const owner = await signUp();
    const other = await signUp();
    const task = toolJson(
      await callTool(
        'upsert_task',
        { title: 'Private', status: 'TODO' },
        owner,
      ),
    );
    const res = await rpc(
      'resources/read',
      { uri: `task://${task.id}` },
      other,
    );
    expect(res.error?.message).toContain('Task belongs to another user');
  });

  it('rejects an invalid status', async () => {
    const token = await signUp();
    const res = await callTool(
      'upsert_task',
      { title: 'x', status: 'NOPE' },
      token,
    );
    expect(res.result?.isError ?? !!res.error).toBe(true);
  });

  it('find_tasks filters the meetings visible to the user', async () => {
    const token = await signUp();
    const meet = (title: string, date: string) =>
      request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, date, participants: [] })
        .expect(201);
    await meet('Planning', '2030-01-10T10:00:00.000Z');
    await meet('Retro', '2030-02-10T10:00:00.000Z');

    const byText = toolJson<Row[]>(
      await callTool('find_tasks', { query: 'plan' }, token),
    );
    expect(byText.map((m) => m.title)).toEqual(['Planning']);
    const byDate = toolJson<Row[]>(
      await callTool('find_tasks', { from: '2030-02-01T00:00:00Z' }, token),
    );
    expect(byDate.map((m) => m.title)).toEqual(['Retro']);
  });

  it('marks find_tasks read-only and upsert_task as writing', async () => {
    const { result } = await rpc('tools/list');
    const hint = (name: string) =>
      result.tools.find((t) => t.name === name)?.annotations?.readOnlyHint;
    expect(hint('find_tasks')).toBe(true);
    expect(hint('upsert_task')).toBe(false);
  });

  it('lists exactly the open-tasks resource and the task template', async () => {
    const { result } = await rpc('resources/list');
    expect(result.resources.map((r) => r.uri)).toEqual(['tasks://open']);
    const templates = await rpc('resources/templates/list');
    expect(
      templates.result.resourceTemplates.map((t) => t.uriTemplate),
    ).toEqual(['task://{id}']);
  });

  it('rejects an upsert without a status', async () => {
    const token = await signUp();
    const res = await callTool('upsert_task', { title: 'x' }, token);
    expect(res.result?.isError ?? !!res.error).toBe(true);
    const open = await rpc('resources/read', { uri: 'tasks://open' }, token);
    expect(resourceJson<Row[]>(open)).toEqual([]);
  });

  it('serves resources as JSON and echoes their uri', async () => {
    const token = await signUp();
    const task = toolJson(
      await callTool(
        'upsert_task',
        { title: 'Done already', status: 'DONE' },
        token,
      ),
    );
    const res = await rpc(
      'resources/read',
      { uri: `task://${task.id}` },
      token,
    );
    expect(res.result.contents[0]).toMatchObject({
      uri: `task://${task.id}`,
      mimeType: 'application/json',
    });
    // task://{id} returns a task of any status, tasks://open only open ones.
    expect(resourceJson(res)).toMatchObject({ status: 'DONE' });
  });

  it('answers a malformed or unknown task id with Task not found', async () => {
    const token = await signUp();
    for (const id of ['missing', randomUUID()]) {
      const res = await rpc('resources/read', { uri: `task://${id}` }, token);
      expect(res.error?.message).toContain('Task not found');
    }
  });

  it('rejects an unknown resource uri', async () => {
    const token = await signUp();
    const res = await rpc('resources/read', { uri: 'nothing://here' }, token);
    expect(res.error).toBeDefined();
  });
});
