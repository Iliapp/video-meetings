import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createApiClient } from './api-client.js';
import { createServer } from './server.js';

const meetings = [
  {
    id: '1',
    title: 'Sprint planning',
    date: '2026-11-01T10:00:00.000Z',
    participants: [],
    ownerId: 'u1',
  },
  {
    id: '2',
    title: 'Design review',
    date: '2026-11-05T10:00:00.000Z',
    participants: ['a@b.c'],
    ownerId: 'u2',
  },
];

// Fake api: `POST /auth/login` issues a token, `GET /meetings` needs it.
let api: Server;
let apiUrl: string;
let logins: number;
let validToken: string;

beforeAll(async () => {
  api = createHttpServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && req.url === '/auth/login') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const { email, password } = JSON.parse(
          Buffer.concat(chunks).toString(),
        ) as { email: string; password: string };
        if (email !== 'me@example.com' || password !== 'secret') {
          return send(401, { message: 'Invalid credentials' });
        }
        validToken = `token-${++logins}`;
        send(200, { accessToken: validToken });
      });
    } else if (req.method === 'GET' && req.url === '/meetings') {
      if (req.headers.authorization !== `Bearer ${validToken}`) {
        return send(401, { message: 'Unauthorized' });
      }
      send(200, meetings);
    } else {
      send(404, {});
    }
  });
  await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => api.close(resolve)));

beforeEach(() => {
  logins = 0;
  validToken = '';
});

async function connect(password = 'secret') {
  const server = createServer(
    createApiClient({ url: apiUrl, email: 'me@example.com', password }),
  );
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

const titles = (result: Awaited<ReturnType<Client['callTool']>>) =>
  (
    JSON.parse((result.content as { text: string }[])[0].text) as {
      title: string;
    }[]
  ).map((task) => task.title);

describe('MCP server (through an MCP client)', () => {
  it('lists only find_tasks, with its input schema', async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['find_tasks']);
    expect(Object.keys(tools[0].inputSchema.properties ?? {})).toEqual([
      'query',
      'from',
      'to',
    ]);
    await client.close();
  });

  it('returns the logged-in user’s tasks and applies filters', async () => {
    const client = await connect();

    expect(
      titles(await client.callTool({ name: 'find_tasks', arguments: {} })),
    ).toEqual(['Sprint planning', 'Design review']);
    expect(
      titles(
        await client.callTool({
          name: 'find_tasks',
          arguments: { query: 'review', from: '2026-11-02T00:00:00Z' },
        }),
      ),
    ).toEqual(['Design review']);
    expect(logins).toBe(1);
    await client.close();
  });

  it('logs in again when the token is rejected', async () => {
    const client = await connect();
    await client.callTool({ name: 'find_tasks', arguments: {} });
    validToken = 'rotated'; // the api no longer accepts the cached token

    const result = await client.callTool({ name: 'find_tasks', arguments: {} });

    expect(result.isError).toBeUndefined();
    expect(logins).toBe(2);
    await client.close();
  });

  it('reports a failed login as a tool error', async () => {
    const client = await connect('wrong');
    const result = await client.callTool({ name: 'find_tasks', arguments: {} });

    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0].text).toContain('401');
    await client.close();
  });

  it('rejects an invalid date filter', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'find_tasks',
      arguments: { from: 'yesterday' },
    });

    expect(result.isError).toBe(true);
    await client.close();
  });
});
