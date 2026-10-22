import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface ProfileResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface TestUser {
  email: string;
  id: string;
  token: string;
}

const PASSWORD = 'Str0ngPassw0rd!';

const uniqueEmail = () => `user-${randomUUID()}@example.com`;

const decodeSub = (token: string): string => {
  const [, payload] = token.split('.');
  return (
    JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string;
    }
  ).sub;
};

describe('Profile (e2e)', () => {
  let app: INestApplication<App>;

  const server = () => app.getHttpServer();

  const signUp = async (email = uniqueEmail()): Promise<TestUser> => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    const token = (res.body as { accessToken: string }).accessToken;
    return { email, id: decodeSub(token), token };
  };

  const getProfile = (user: TestUser | null) => {
    const req = request(server()).get('/users/me');
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  const updateProfile = (user: TestUser | null, body: object) => {
    const req = request(server()).patch('/users/me').send(body);
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  const storedName = async (user: TestUser) => {
    const res = await getProfile(user).expect(200);
    return (res.body as ProfileResponse).name;
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

  describe('GET /users/me', () => {
    it('returns 401 without a token', async () => {
      await getProfile(null).expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await request(server())
        .get('/users/me')
        .auth('not-a-jwt', { type: 'bearer' })
        .expect(401);
    });

    it('returns the profile of the signed-in user', async () => {
      const user = await signUp();

      const res = await getProfile(user).expect(200);

      expect(res.body).toEqual({
        id: user.id,
        email: user.email,
        name: null,
        avatarUrl: null,
      });
    });

    it("does not show another user's name", async () => {
      const first = await signUp();
      const second = await signUp();
      await updateProfile(first, { name: 'Ann' }).expect(200);

      const res = await getProfile(second).expect(200);

      expect(res.body).toMatchObject({
        id: second.id,
        email: second.email,
        name: null,
      });
    });
  });

  describe('PATCH /users/me', () => {
    it('returns 401 without a token', async () => {
      await updateProfile(null, { name: 'Ann' }).expect(401);
    });

    it('trims and saves the name, and a following GET returns it', async () => {
      const user = await signUp();

      const res = await updateProfile(user, { name: '  Ann  ' }).expect(200);

      expect(res.body).toEqual({
        id: user.id,
        email: user.email,
        name: 'Ann',
        avatarUrl: null,
      });
      expect(await storedName(user)).toBe('Ann');
    });

    it('accepts a name of exactly 100 characters', async () => {
      const user = await signUp();
      const name = 'a'.repeat(100);

      await updateProfile(user, { name }).expect(200);

      expect(await storedName(user)).toBe(name);
    });

    it('counts the length after trimming', async () => {
      const user = await signUp();
      const name = 'a'.repeat(100);

      await updateProfile(user, { name: `  ${name}  ` }).expect(200);

      expect(await storedName(user)).toBe(name);
    });

    it('keeps the stored name when name is omitted', async () => {
      const user = await signUp();
      await updateProfile(user, { name: 'Ann' }).expect(200);

      await updateProfile(user, {}).expect(200);

      expect(await storedName(user)).toBe('Ann');
    });

    it('clears the name with null', async () => {
      const user = await signUp();
      await updateProfile(user, { name: 'Ann' }).expect(200);

      const res = await updateProfile(user, { name: null }).expect(200);

      expect((res.body as ProfileResponse).name).toBeNull();
      expect(await storedName(user)).toBeNull();
    });

    it.each([
      ['the name is blank after trimming', { name: '   ' }],
      ['the name is empty', { name: '' }],
      ['the name is longer than 100 characters', { name: 'a'.repeat(101) }],
      ['the name is not a string', { name: 123 }],
    ])(
      'returns 400 with a message when %s and keeps the stored name',
      async (_case, body) => {
        const user = await signUp();
        await updateProfile(user, { name: 'Ann' }).expect(200);

        const res = await updateProfile(user, body).expect(400);

        expect(
          JSON.stringify((res.body as { message: unknown }).message),
        ).toMatch(/name/i);
        expect(await storedName(user)).toBe('Ann');
      },
    );
  });
});
