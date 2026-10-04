import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface AuthResponse {
  accessToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

const PASSWORD = 'Str0ngPassw0rd!';

// Every test gets its own address so runs don't collide on the unique email.
const uniqueEmail = () => `user-${randomUUID()}@example.com`;

const decodeJwt = (token: string): JwtPayload => {
  const [, payload] = token.split('.');
  return JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as JwtPayload;
};

const expectJwt = (body: AuthResponse, email: string): JwtPayload => {
  expect(typeof body.accessToken).toBe('string');
  expect(body.accessToken.split('.')).toHaveLength(3);

  const payload = decodeJwt(body.accessToken);
  expect(payload.sub).toEqual(expect.any(String));
  expect(payload.email).toBe(email);
  expect(payload.exp).toBeGreaterThan(payload.iat);
  return payload;
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

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

  describe('POST /auth/register', () => {
    it('creates a user and returns a JWT', async () => {
      const email = uniqueEmail();

      const res = await register({ email, password: PASSWORD }).expect(201);

      expectJwt(res.body as AuthResponse, email);
    });

    it('does not expose the password in the response', async () => {
      const res = await register({
        email: uniqueEmail(),
        password: PASSWORD,
      }).expect(201);

      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
      expect(res.body).not.toHaveProperty('password');
    });

    it('returns 409 when the email is already registered', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await register({ email, password: 'An0therPassword!' }).expect(409);
    });

    it.each([
      ['email is missing', { password: PASSWORD }],
      ['password is missing', { email: 'missing-password@example.com' }],
      ['email is invalid', { email: 'not-an-email', password: PASSWORD }],
      [
        'password is shorter than 8 characters',
        { email: 'short-password@example.com', password: 'short' },
      ],
      ['email is not a string', { email: 123, password: PASSWORD }],
      [
        'password is not a string',
        { email: uniqueEmail(), password: 12345678 },
      ],
    ])('returns 400 when %s', async (_case, body) => {
      await register(body).expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns a JWT for an existing user', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      const res = await login({ email, password: PASSWORD }).expect(200);

      expectJwt(res.body as AuthResponse, email);
    });

    it('finds the user created at registration instead of creating a new one', async () => {
      const email = uniqueEmail();
      const registered = await register({ email, password: PASSWORD }).expect(
        201,
      );

      const loggedIn = await login({ email, password: PASSWORD }).expect(200);

      const registeredSub = decodeJwt(
        (registered.body as AuthResponse).accessToken,
      ).sub;
      const loggedInSub = decodeJwt(
        (loggedIn.body as AuthResponse).accessToken,
      ).sub;
      expect(loggedInSub).toBe(registeredSub);
    });

    it('returns 401 when the password is wrong', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      const res = await login({ email, password: 'Wr0ngPassword!' }).expect(
        401,
      );

      expect(res.body).not.toHaveProperty('accessToken');
    });

    it('returns 401 when the user does not exist', async () => {
      const res = await login({
        email: uniqueEmail(),
        password: PASSWORD,
      }).expect(401);

      expect(res.body).not.toHaveProperty('accessToken');
    });

    it('does not create a user when the email is unknown', async () => {
      const email = uniqueEmail();
      await login({ email, password: PASSWORD }).expect(401);

      // Registration would return 409 if the failed login had created the user.
      await register({ email, password: PASSWORD }).expect(201);
    });

    it('does not reveal whether the email exists', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      const wrongPassword = await login({
        email,
        password: 'Wr0ngPassword!',
      }).expect(401);
      const unknownEmail = await login({
        email: uniqueEmail(),
        password: PASSWORD,
      }).expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it.each([
      ['email is missing', { password: PASSWORD }],
      ['password is missing', { email: 'missing-password@example.com' }],
      ['email is invalid', { email: 'not-an-email', password: PASSWORD }],
    ])('returns 400 when %s', async (_case, body) => {
      await login(body).expect(400);
    });
  });
});
