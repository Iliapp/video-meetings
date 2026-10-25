import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface TestUser {
  email: string;
  token: string;
}

const PASSWORD = 'Str0ngPassw0rd!';
const NEW_PASSWORD = 'N3wStr0ngPassw0rd!';

const uniqueEmail = () => `user-${randomUUID()}@example.com`;

describe('Change password (e2e)', () => {
  let app: INestApplication<App>;

  const server = () => app.getHttpServer();

  const signUp = async (email = uniqueEmail()): Promise<TestUser> => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { email, token: (res.body as { accessToken: string }).accessToken };
  };

  const login = (email: string, password: string) =>
    request(server()).post('/auth/login').send({ email, password });

  const changePassword = (user: TestUser | null, body: object) => {
    const req = request(server()).post('/auth/change-password').send(body);
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/change-password', () => {
    it('returns 204 and replaces the password', async () => {
      const user = await signUp();

      await changePassword(user, {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      }).expect(204);

      await login(user.email, PASSWORD).expect(401);
      await login(user.email, NEW_PASSWORD).expect(200);
    });

    it('keeps the token used for the change working', async () => {
      const user = await signUp();

      await changePassword(user, {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      }).expect(204);

      await request(server())
        .get('/users/me')
        .auth(user.token, { type: 'bearer' })
        .expect(200);
    });

    // Not 401: the web treats a 401 as a lost session and signs out.
    it('returns 400 when the current password is wrong, keeps the old one and the session', async () => {
      const user = await signUp();

      const res = await changePassword(user, {
        currentPassword: 'Wr0ngPassword!',
        newPassword: NEW_PASSWORD,
      }).expect(400);

      expect((res.body as { message: unknown }).message).toBe(
        'Current password is incorrect',
      );
      await login(user.email, PASSWORD).expect(200);
      await login(user.email, NEW_PASSWORD).expect(401);
      await request(server())
        .get('/users/me')
        .auth(user.token, { type: 'bearer' })
        .expect(200);
    });

    it('returns 400 when the new password is shorter than 8 characters and keeps the old one', async () => {
      const user = await signUp();

      await changePassword(user, {
        currentPassword: PASSWORD,
        newPassword: 'short',
      }).expect(400);

      await login(user.email, PASSWORD).expect(200);
    });

    it.each([
      ['currentPassword is missing', { newPassword: NEW_PASSWORD }],
      ['newPassword is missing', { currentPassword: PASSWORD }],
      [
        'newPassword is not a string',
        { currentPassword: PASSWORD, newPassword: 12345678 },
      ],
    ])('returns 400 when %s', async (_case, body) => {
      const user = await signUp();

      await changePassword(user, body).expect(400);
    });

    it('returns 401 without a token', async () => {
      await changePassword(null, {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      }).expect(401);
    });
  });
});
