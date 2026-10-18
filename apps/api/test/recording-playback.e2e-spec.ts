import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface RecordingResponse {
  id: string;
  originalName: string;
  mimeType: string;
}

interface RecordingUrls {
  streamUrl: string;
  downloadUrl: string;
  expiresAt: string;
}

interface TestUser {
  email: string;
  token: string;
}

const PASSWORD = 'Str0ngPassw0rd!';
const RECORDINGS_DIR = process.env.RECORDINGS_DIR as string;

const uniqueEmail = () => `user-${randomUUID()}@example.com`;

const fixture = (name: string): Buffer =>
  readFileSync(join(__dirname, 'fixtures', name));

const storedFiles = () =>
  existsSync(RECORDINGS_DIR)
    ? readdirSync(RECORDINGS_DIR).filter((name) => name !== 'incoming')
    : [];

// superagent only buffers text and JSON by default; media responses need this
// to land in res.body as a Buffer. At runtime `res` is Node's response stream,
// though superagent's types call it a Response.
const binary = (
  res: Response,
  done: (err: Error | null, body: Buffer) => void,
) => {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => done(null, Buffer.concat(chunks)));
};

// Signed URLs are absolute; supertest needs the path and query only.
const pathOf = (url: string) => {
  const { pathname, search } = new URL(url);
  return pathname + search;
};

const withToken = (url: string, token: string | null) => {
  const parsed = new URL(url);
  if (token === null) {
    parsed.searchParams.delete('token');
  } else {
    parsed.searchParams.set('token', token);
  }
  return parsed.toString();
};

// fetchFile() reads every body as a Buffer, the JSON error included.
const expectRecordingNotFound = (res: Response) => {
  expect(res.status).toBe(404);
  const body: unknown = Buffer.isBuffer(res.body)
    ? JSON.parse(res.body.toString())
    : res.body;
  expect(body).toMatchObject({ message: 'Recording not found' });
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('Recording playback, download and delete (e2e)', () => {
  let app: INestApplication<App>;

  const server = () => app.getHttpServer();

  const startApp = async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.listen(0);
  };

  const signUp = async (email = uniqueEmail()): Promise<TestUser> => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { email, token: (res.body as { accessToken: string }).accessToken };
  };

  const createMeeting = async (
    owner: TestUser,
    participants: string[] = [],
  ): Promise<string> => {
    const res = await request(server())
      .post('/meetings')
      .auth(owner.token, { type: 'bearer' })
      .send({ title: 'Retro', date: '2026-11-01T10:00:00.000Z', participants })
      .expect(201);
    return (res.body as { id: string }).id;
  };

  const upload = async (
    owner: TestUser,
    meetingId: string,
    name = 'sample.mp4',
    buffer = fixture('sample.mp4'),
  ) => {
    const res = await request(server())
      .post(`/meetings/${meetingId}/recordings`)
      .auth(owner.token, { type: 'bearer' })
      .attach('file', buffer, { filename: name })
      .expect(201);
    return res.body as RecordingResponse;
  };

  const getUrls = (
    user: TestUser | null,
    meetingId: string,
    recordingId: string,
  ) => {
    const req = request(server()).get(
      `/meetings/${meetingId}/recordings/${recordingId}/urls`,
    );
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  const urlsFor = async (
    user: TestUser,
    meetingId: string,
    recordingId: string,
  ) => {
    const res = await getUrls(user, meetingId, recordingId).expect(200);
    return res.body as RecordingUrls;
  };

  const fetchFile = (url: string, range?: string) => {
    const req = request(server()).get(pathOf(url)).buffer(true).parse(binary);
    return range ? req.set('Range', range) : req;
  };

  const deleteRecording = (
    user: TestUser | null,
    meetingId: string,
    recordingId: string,
  ) => {
    const req = request(server()).delete(
      `/meetings/${meetingId}/recordings/${recordingId}`,
    );
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  // A meeting with one MP4 recording and an invited participant.
  const setup = async () => {
    const owner = await signUp();
    const invited = await signUp();
    const meetingId = await createMeeting(owner, [invited.email]);
    const recording = await upload(owner, meetingId);
    return { owner, invited, meetingId, recording };
  };

  beforeAll(async () => {
    await startApp();
  });

  afterAll(async () => {
    await app.close();
    rmSync(RECORDINGS_DIR, { recursive: true, force: true });
  });

  describe('GET /meetings/:id/recordings/:recordingId/urls', () => {
    it('issues stream and download URLs to the owner', async () => {
      const { owner, meetingId, recording } = await setup();
      const before = Date.now();

      const urls = await urlsFor(owner, meetingId, recording.id);

      expect(urls).toEqual({
        streamUrl: expect.any(String) as string,
        downloadUrl: expect.any(String) as string,
        expiresAt: expect.any(String) as string,
      });
      expect(new URL(urls.streamUrl).pathname).toBe(
        `/recordings/${recording.id}/stream`,
      );
      expect(new URL(urls.downloadUrl).pathname).toBe(
        `/recordings/${recording.id}/download`,
      );
      expect(new URL(urls.streamUrl).searchParams.get('token')).toBeTruthy();
      // Default RECORDING_URL_TTL is 6 hours.
      expect(Date.parse(urls.expiresAt) - before).toBeGreaterThan(
        5 * 60 * 60 * 1000,
      );
    });

    it('issues URLs to an invited participant', async () => {
      const { invited, meetingId, recording } = await setup();

      const urls = await urlsFor(invited, meetingId, recording.id);

      await fetchFile(urls.streamUrl).expect(200);
    });

    it('returns 404 to a user who is not invited', async () => {
      const { meetingId, recording } = await setup();
      const outsider = await signUp();

      const res = await getUrls(outsider, meetingId, recording.id).expect(404);

      expect(res.body).toMatchObject({ message: 'Meeting not found' });
    });

    it('returns 404 for an unknown recording', async () => {
      const { owner, meetingId } = await setup();

      expectRecordingNotFound(await getUrls(owner, meetingId, randomUUID()));
    });

    it('returns 404 when the recording id is not a UUID', async () => {
      const { owner, meetingId } = await setup();

      expectRecordingNotFound(await getUrls(owner, meetingId, 'not-a-uuid'));
    });

    it('returns 404 for a recording of another meeting', async () => {
      const { owner, recording } = await setup();
      const otherMeetingId = await createMeeting(owner);

      expectRecordingNotFound(
        await getUrls(owner, otherMeetingId, recording.id),
      );
    });

    it('returns 401 without a token', async () => {
      const { meetingId, recording } = await setup();

      await getUrls(null, meetingId, recording.id).expect(401);
    });
  });

  describe('stream', () => {
    it.each([
      ['sample.mp4', 'video/mp4'],
      ['sample.webm', 'video/webm'],
      ['sample.mp3', 'audio/mpeg'],
      ['sample.m4a', 'audio/mp4'],
      ['sample.wav', 'audio/wav'],
    ])('serves %s with MIME type %s and nosniff', async (name, mimeType) => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const buffer = fixture(name);
      const recording = await upload(owner, meetingId, name, buffer);
      const { streamUrl } = await urlsFor(owner, meetingId, recording.id);

      const res = await fetchFile(streamUrl).expect(200);

      expect(res.headers['content-type']).toBe(mimeType);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-disposition']).toBeUndefined();
      expect(res.body).toEqual(buffer);
    });

    it('answers a Range request with 206 and the requested bytes', async () => {
      const { owner, meetingId, recording } = await setup();
      const buffer = fixture('sample.mp4');
      const { streamUrl } = await urlsFor(owner, meetingId, recording.id);

      const res = await fetchFile(streamUrl, 'bytes=0-99').expect(206);

      expect(res.headers['content-range']).toBe(`bytes 0-99/${buffer.length}`);
      expect(res.headers['content-type']).toBe('video/mp4');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.body).toEqual(buffer.subarray(0, 100));
    });

    it('answers an open-ended Range request from the middle', async () => {
      const { owner, meetingId, recording } = await setup();
      const buffer = fixture('sample.mp4');
      const { streamUrl } = await urlsFor(owner, meetingId, recording.id);

      const res = await fetchFile(streamUrl, 'bytes=1000-').expect(206);

      expect(res.body).toEqual(buffer.subarray(1000));
    });

    it('answers 416 for a range past the end of the file', async () => {
      const { owner, meetingId, recording } = await setup();
      const { streamUrl } = await urlsFor(owner, meetingId, recording.id);

      await fetchFile(streamUrl, 'bytes=99999999-').expect(416);
    });
  });

  describe('download', () => {
    it('serves the original bytes as an attachment with the original name', async () => {
      const { owner, meetingId, recording } = await setup();
      const { downloadUrl } = await urlsFor(owner, meetingId, recording.id);

      const res = await fetchFile(downloadUrl).expect(200);

      expect(res.body).toEqual(fixture('sample.mp4'));
      expect(res.headers['content-type']).toBe('video/mp4');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="sample.mp4"',
      );
    });

    it('encodes a non-ASCII file name with filename*', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const name = 'Зустріч команди.mp3';
      const recording = await upload(
        owner,
        meetingId,
        name,
        fixture('sample.mp3'),
      );
      const { downloadUrl } = await urlsFor(owner, meetingId, recording.id);

      const res = await fetchFile(downloadUrl).expect(200);

      const disposition = res.headers['content-disposition'];
      expect(disposition).toMatch(/^attachment;/);
      expect(disposition).toContain(
        `filename*=UTF-8''${encodeURIComponent(name)}`,
      );
      expect(res.body).toEqual(fixture('sample.mp3'));
    });
  });

  describe('signed tokens', () => {
    it.each([
      ['missing', null],
      ['empty', ''],
      ['garbage', 'not-a-token'],
    ])('returns 404 when the token is %s', async (_case, token) => {
      const { owner, meetingId, recording } = await setup();
      const urls = await urlsFor(owner, meetingId, recording.id);

      for (const url of [urls.streamUrl, urls.downloadUrl]) {
        expectRecordingNotFound(await fetchFile(withToken(url, token)));
        expectRecordingNotFound(
          await fetchFile(withToken(url, token), 'bytes=0-99'),
        );
      }
    });

    it('returns 404 when the token was tampered with', async () => {
      const { owner, meetingId, recording } = await setup();
      const { streamUrl } = await urlsFor(owner, meetingId, recording.id);
      const token = new URL(streamUrl).searchParams.get('token') as string;
      const last = token.at(-1) === 'A' ? 'B' : 'A';
      const tampered = token.slice(0, -1) + last;

      expectRecordingNotFound(await fetchFile(withToken(streamUrl, tampered)));
    });

    it('returns 404 when the token belongs to another recording', async () => {
      const { owner, meetingId, recording } = await setup();
      const other = await upload(owner, meetingId, 'other.mp4');
      const { streamUrl } = await urlsFor(owner, meetingId, recording.id);
      const otherUrls = await urlsFor(owner, meetingId, other.id);
      const otherToken = new URL(otherUrls.streamUrl).searchParams.get(
        'token',
      ) as string;

      expectRecordingNotFound(
        await fetchFile(withToken(streamUrl, otherToken), 'bytes=0-99'),
      );
    });

    it('does not accept a stream token on the download URL', async () => {
      const { owner, meetingId, recording } = await setup();
      const { streamUrl, downloadUrl } = await urlsFor(
        owner,
        meetingId,
        recording.id,
      );
      const streamToken = new URL(streamUrl).searchParams.get(
        'token',
      ) as string;

      expectRecordingNotFound(
        await fetchFile(withToken(downloadUrl, streamToken)),
      );
    });

    it('does not accept an access token as a URL token', async () => {
      const { owner, meetingId, recording } = await setup();
      const { streamUrl } = await urlsFor(owner, meetingId, recording.id);

      expectRecordingNotFound(
        await fetchFile(withToken(streamUrl, owner.token)),
      );
    });

    describe('expiry', () => {
      const ttl = process.env.RECORDING_URL_TTL;

      beforeAll(async () => {
        await app.close();
        process.env.RECORDING_URL_TTL = '1s';
        await startApp();
      });

      afterAll(async () => {
        await app.close();
        if (ttl === undefined) {
          delete process.env.RECORDING_URL_TTL;
        } else {
          process.env.RECORDING_URL_TTL = ttl;
        }
        await startApp();
      });

      it('returns 404 once the URLs have expired, including on a Range request', async () => {
        const { owner, meetingId, recording } = await setup();
        const urls = await urlsFor(owner, meetingId, recording.id);
        await fetchFile(urls.streamUrl, 'bytes=0-99').expect(206);

        await sleep(Date.parse(urls.expiresAt) - Date.now() + 1100);

        expectRecordingNotFound(await fetchFile(urls.streamUrl));
        expectRecordingNotFound(await fetchFile(urls.streamUrl, 'bytes=0-99'));
        expectRecordingNotFound(await fetchFile(urls.downloadUrl));
      });
    });
  });

  describe('DELETE /meetings/:id/recordings/:recordingId', () => {
    it('lets the owner delete a recording and removes the row and the file', async () => {
      const { owner, invited, meetingId, recording } = await setup();
      const filesBefore = storedFiles();

      await deleteRecording(owner, meetingId, recording.id).expect(204);

      for (const user of [owner, invited]) {
        const res = await request(server())
          .get(`/meetings/${meetingId}/recordings`)
          .auth(user.token, { type: 'bearer' })
          .expect(200);
        expect(res.body).toEqual([]);
      }
      expect(storedFiles()).toHaveLength(filesBefore.length - 1);
      expectRecordingNotFound(await getUrls(owner, meetingId, recording.id));
    });

    it('makes links issued before the delete return 404', async () => {
      const { owner, invited, meetingId, recording } = await setup();
      const ownerUrls = await urlsFor(owner, meetingId, recording.id);
      const invitedUrls = await urlsFor(invited, meetingId, recording.id);

      await deleteRecording(owner, meetingId, recording.id).expect(204);

      for (const url of [
        ownerUrls.streamUrl,
        ownerUrls.downloadUrl,
        invitedUrls.streamUrl,
        invitedUrls.downloadUrl,
      ]) {
        expectRecordingNotFound(await fetchFile(url));
        expectRecordingNotFound(await fetchFile(url, 'bytes=0-99'));
      }
    });

    it('keeps the other recordings of the meeting', async () => {
      const { owner, meetingId, recording } = await setup();
      const other = await upload(owner, meetingId, 'other.mp4');

      await deleteRecording(owner, meetingId, recording.id).expect(204);

      const res = await request(server())
        .get(`/meetings/${meetingId}/recordings`)
        .auth(owner.token, { type: 'bearer' })
        .expect(200);
      expect((res.body as RecordingResponse[]).map((r) => r.id)).toEqual([
        other.id,
      ]);
      const { streamUrl } = await urlsFor(owner, meetingId, other.id);
      await fetchFile(streamUrl).expect(200);
    });

    it('returns 403 to an invited participant and keeps the recording', async () => {
      const { owner, invited, meetingId, recording } = await setup();
      const filesBefore = storedFiles();

      const res = await deleteRecording(invited, meetingId, recording.id);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        message: 'Only the meeting owner can change recordings',
      });
      expect(storedFiles()).toEqual(filesBefore);
      await urlsFor(owner, meetingId, recording.id);
    });

    it('returns 404 to a user who is not invited and keeps the recording', async () => {
      const { owner, meetingId, recording } = await setup();
      const outsider = await signUp();

      const res = await deleteRecording(outsider, meetingId, recording.id);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ message: 'Meeting not found' });
      await urlsFor(owner, meetingId, recording.id);
    });

    it('returns 404 for an unknown recording', async () => {
      const { owner, meetingId } = await setup();

      expectRecordingNotFound(
        await deleteRecording(owner, meetingId, randomUUID()),
      );
      expectRecordingNotFound(
        await deleteRecording(owner, meetingId, 'not-a-uuid'),
      );
    });

    it('returns 404 for a recording that was already deleted', async () => {
      const { owner, meetingId, recording } = await setup();
      await deleteRecording(owner, meetingId, recording.id).expect(204);

      expectRecordingNotFound(
        await deleteRecording(owner, meetingId, recording.id),
      );
    });

    it('returns 404 for a recording of another meeting and keeps it', async () => {
      const { owner, meetingId, recording } = await setup();
      const otherMeetingId = await createMeeting(owner);

      expectRecordingNotFound(
        await deleteRecording(owner, otherMeetingId, recording.id),
      );
      await urlsFor(owner, meetingId, recording.id);
    });

    it('returns 401 without a token', async () => {
      const { meetingId, recording } = await setup();

      await deleteRecording(null, meetingId, recording.id).expect(401);
    });
  });
});
