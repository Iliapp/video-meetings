import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  token: string;
}

interface Upload {
  buffer: Buffer;
  name: string;
  contentType?: string;
}

const PASSWORD = 'Str0ngPassw0rd!';
const MAX_BYTES = Number(process.env.AVATAR_MAX_BYTES ?? 5 * 1024 * 1024);
const UNSUPPORTED_MESSAGE = 'Unsupported file format. Allowed: JPG, PNG, WebP';

const uniqueEmail = () => `user-${randomUUID()}@example.com`;

const fixture = (name: string): Buffer =>
  readFileSync(join(__dirname, 'fixtures', name));

const png = (): Upload => ({
  buffer: fixture('avatar.png'),
  name: 'avatar.png',
});
const jpg = (): Upload => ({
  buffer: fixture('avatar.jpg'),
  name: 'avatar.jpg',
});

// avatarUrl may be absolute or relative to the api; supertest needs the path.
const pathOf = (url: string) => {
  const { pathname, search } = new URL(url, 'http://localhost');
  return pathname + search;
};

describe('Avatar (e2e)', () => {
  let app: INestApplication<App>;

  const server = () => app.getHttpServer();

  const signUp = async (email = uniqueEmail()): Promise<TestUser> => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { email, token: (res.body as { accessToken: string }).accessToken };
  };

  const upload = (
    user: TestUser | null,
    { buffer, name, contentType }: Upload,
  ) => {
    const req = request(server()).put('/users/me/avatar');
    if (user) {
      void req.auth(user.token, { type: 'bearer' });
    }
    return req.attach('file', buffer, { filename: name, contentType });
  };

  const removeAvatar = (user: TestUser | null) => {
    const req = request(server()).delete('/users/me/avatar');
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  const avatarUrl = async (user: TestUser) => {
    const res = await request(server())
      .get('/users/me')
      .auth(user.token, { type: 'bearer' })
      .expect(200);
    return (res.body as ProfileResponse).avatarUrl;
  };

  // Uploads a file and returns the avatarUrl the profile reports afterwards.
  const uploadedUrl = async (user: TestUser, file: Upload) => {
    await upload(user, file).expect(200);
    const url = await avatarUrl(user);
    expect(url).toEqual(expect.any(String));
    return url as string;
  };

  // No Bearer header: <img src> can't send one.
  const fetchAvatar = (url: string) =>
    request(server())
      .get(pathOf(url))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });

  const expectServes = async (
    url: string,
    buffer: Buffer,
    mimeType: string,
  ) => {
    const res = await fetchAvatar(url).expect(200);
    expect(res.headers['content-type']).toMatch(
      new RegExp(`^${mimeType.replace('/', '\\/')}`),
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body).toEqual(buffer);
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

  describe('PUT /users/me/avatar', () => {
    it('returns 401 without a token', async () => {
      await upload(null, png()).expect(401);
    });

    it.each([
      ['avatar.jpg', 'image/jpeg'],
      ['avatar.png', 'image/png'],
      ['avatar.webp', 'image/webp'],
    ])(
      'stores %s and serves it at avatarUrl with MIME type %s',
      async (name, mimeType) => {
        const user = await signUp();
        const buffer = fixture(name);

        const res = await upload(user, { buffer, name }).expect(200);

        const url = await avatarUrl(user);
        expect(url).toEqual(expect.any(String));
        expect(res.body).toMatchObject({ email: user.email, avatarUrl: url });
        await expectServes(url as string, buffer, mimeType);
      },
    );

    it('ignores the Content-Type sent by the client', async () => {
      const user = await signUp();

      const url = await uploadedUrl(user, {
        ...png(),
        contentType: 'text/html',
      });

      await expectServes(url, fixture('avatar.png'), 'image/png');
    });

    it('replaces the previous avatar, and the old URL returns 404', async () => {
      const user = await signUp();
      const oldUrl = await uploadedUrl(user, png());

      const newUrl = await uploadedUrl(user, jpg());

      expect(newUrl).not.toBe(oldUrl);
      await expectServes(newUrl, fixture('avatar.jpg'), 'image/jpeg');
      await fetchAvatar(oldUrl).expect(404);
    });

    it('gives a new URL when the same file is uploaded again', async () => {
      const user = await signUp();
      const oldUrl = await uploadedUrl(user, png());

      const newUrl = await uploadedUrl(user, png());

      expect(newUrl).not.toBe(oldUrl);
      await fetchAvatar(oldUrl).expect(404);
    });

    it.each([
      [
        'an unsupported extension (.gif)',
        { buffer: fixture('avatar.gif'), name: 'avatar.gif' },
      ],
      [
        'a file without an extension',
        { buffer: fixture('avatar.png'), name: 'avatar' },
      ],
      [
        'a text file renamed to .png',
        {
          buffer: Buffer.from('just some text, not an image\n'.repeat(20)),
          name: 'renamed.png',
          contentType: 'image/png',
        },
      ],
      [
        'a GIF renamed to .jpg',
        { buffer: fixture('avatar.gif'), name: 'renamed.jpg' },
      ],
      [
        'a PNG renamed to .webp',
        { buffer: fixture('avatar.png'), name: 'renamed.webp' },
      ],
    ])(
      'returns 415 for %s and keeps the previous avatar',
      async (_case, file: Upload) => {
        const user = await signUp();
        const url = await uploadedUrl(user, png());

        const res = await upload(user, file).expect(415);

        expect(res.body).toMatchObject({ message: UNSUPPORTED_MESSAGE });
        expect(await avatarUrl(user)).toBe(url);
        await expectServes(url, fixture('avatar.png'), 'image/png');
      },
    );

    it('returns 415 and keeps no avatar when there was none', async () => {
      const user = await signUp();

      await upload(user, {
        buffer: fixture('avatar.gif'),
        name: 'avatar.gif',
      }).expect(415);

      expect(await avatarUrl(user)).toBeNull();
    });

    it('returns 413 for a file over the size limit and keeps the previous avatar', async () => {
      const user = await signUp();
      const url = await uploadedUrl(user, png());
      const image = fixture('avatar.jpg');
      const buffer = Buffer.concat([
        image,
        Buffer.alloc(MAX_BYTES + 1 - image.length),
      ]);

      const res = await upload(user, { buffer, name: 'big.jpg' }).expect(413);

      expect((res.body as { message: string }).message).toMatch(
        /^File is larger than /,
      );
      expect(await avatarUrl(user)).toBe(url);
      await expectServes(url, fixture('avatar.png'), 'image/png');
    });

    it('accepts a file exactly at the size limit', async () => {
      const user = await signUp();
      const image = fixture('avatar.jpg');
      const buffer = Buffer.concat([
        image,
        Buffer.alloc(MAX_BYTES - image.length),
      ]);

      const url = await uploadedUrl(user, { buffer, name: 'exact.jpg' });

      await expectServes(url, buffer, 'image/jpeg');
    });

    it('returns 400 when no file is sent', async () => {
      const user = await signUp();

      await request(server())
        .put('/users/me/avatar')
        .auth(user.token, { type: 'bearer' })
        .field('other', 'value')
        .expect(400);

      expect(await avatarUrl(user)).toBeNull();
    });

    it("does not change another user's avatar", async () => {
      const first = await signUp();
      const second = await signUp();
      const firstUrl = await uploadedUrl(first, png());

      const secondUrl = await uploadedUrl(second, jpg());

      expect(secondUrl).not.toBe(firstUrl);
      expect(await avatarUrl(first)).toBe(firstUrl);
      await expectServes(firstUrl, fixture('avatar.png'), 'image/png');
    });
  });

  describe('DELETE /users/me/avatar', () => {
    it('returns 401 without a token', async () => {
      await removeAvatar(null).expect(401);
    });

    it('removes the avatar: 204, avatarUrl null and the old URL returns 404', async () => {
      const user = await signUp();
      const url = await uploadedUrl(user, png());

      await removeAvatar(user).expect(204);

      expect(await avatarUrl(user)).toBeNull();
      await fetchAvatar(url).expect(404);
    });

    it('returns 204 when there is no avatar', async () => {
      const user = await signUp();

      await removeAvatar(user).expect(204);

      expect(await avatarUrl(user)).toBeNull();
    });

    it("does not remove another user's avatar", async () => {
      const first = await signUp();
      const second = await signUp();
      const firstUrl = await uploadedUrl(first, png());
      await uploadedUrl(second, jpg());

      await removeAvatar(second).expect(204);

      expect(await avatarUrl(first)).toBe(firstUrl);
      await expectServes(firstUrl, fixture('avatar.png'), 'image/png');
    });
  });

  describe('avatar URLs', () => {
    it('returns 404 for an unknown avatar URL', async () => {
      const user = await signUp();
      const url = await uploadedUrl(user, png());
      const { pathname } = new URL(url, 'http://localhost');
      const unknown = pathname.replace(/[^/]+$/, randomUUID());

      await fetchAvatar(unknown).expect(404);
    });
  });
});
