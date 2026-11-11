import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface TaskResponse {
  id: string;
  title: string;
  status: string;
  ownerId: string;
}

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();

  const signUp = async (): Promise<string> => {
    const res = await request(server())
      .post('/auth/register')
      .send({
        email: `user-${randomUUID()}@example.com`,
        password: 'Str0ngPassw0rd!',
      })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  };

  const put = (token: string, body: object) =>
    request(server())
      .put('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('rejects requests without a token', () =>
    request(server())
      .put('/tasks')
      .send({ title: 'x', status: 'TODO' })
      .expect(401));

  it('creates a task', async () => {
    const token = await signUp();
    const res = await put(token, {
      title: '  Write docs ',
      status: 'TODO',
    }).expect(200);

    expect(res.body).toMatchObject({ title: 'Write docs', status: 'TODO' });
  });

  it('updates the status of an existing task instead of duplicating it', async () => {
    const token = await signUp();
    const first = (
      await put(token, { title: 'Ship', status: 'TODO' }).expect(200)
    ).body as TaskResponse;
    const second = (
      await put(token, { title: 'Ship', status: 'DONE' }).expect(200)
    ).body as TaskResponse;

    expect(second.id).toBe(first.id);
    expect(second.status).toBe('DONE');
  });

  it('keeps tasks of different users apart', async () => {
    const a = (
      await put(await signUp(), { title: 'Same', status: 'TODO' }).expect(200)
    ).body as TaskResponse;
    const b = (
      await put(await signUp(), { title: 'Same', status: 'TODO' }).expect(200)
    ).body as TaskResponse;

    expect(b.id).not.toBe(a.id);
  });

  it.each([
    { title: '', status: 'TODO' },
    { title: '   ', status: 'TODO' },
    { title: 'x', status: 'NOPE' },
    { title: 'x' },
    { status: 'TODO' },
  ])('rejects invalid body %j', async (body) => {
    await put(await signUp(), body).expect(400);
  });

  describe('reading', () => {
    const get = (token: string, path: string) =>
      request(server()).get(path).set('Authorization', `Bearer ${token}`);

    it('GET /tasks lists only the caller’s open tasks', async () => {
      const token = await signUp();
      await put(token, { title: 'A', status: 'TODO' }).expect(200);
      await put(token, { title: 'B', status: 'IN_PROGRESS' }).expect(200);
      await put(token, { title: 'C', status: 'DONE' }).expect(200);
      await put(await signUp(), { title: 'D', status: 'TODO' }).expect(200);

      const res = await get(token, '/tasks').expect(200);

      expect(
        (res.body as TaskResponse[]).map((task) => task.title).sort(),
      ).toEqual(['A', 'B']);
    });

    it('GET /tasks needs a token', () =>
      request(server()).get('/tasks').expect(401));

    it('GET /tasks/:id returns the caller’s task, any status', async () => {
      const token = await signUp();
      const created = (
        await put(token, { title: 'Done one', status: 'DONE' }).expect(200)
      ).body as TaskResponse;

      const res = await get(token, `/tasks/${created.id}`).expect(200);

      expect(res.body).toMatchObject({ id: created.id, status: 'DONE' });
    });

    it('GET /tasks/:id is 404 for another user’s, unknown and malformed ids', async () => {
      const created = (
        await put(await signUp(), { title: 'Mine', status: 'TODO' }).expect(200)
      ).body as TaskResponse;
      const token = await signUp();

      for (const id of [created.id, randomUUID(), 'not-a-uuid']) {
        const res = await get(token, `/tasks/${id}`).expect(404);
        expect(res.body).toMatchObject({ message: 'Task not found' });
      }
    });
  });
});
