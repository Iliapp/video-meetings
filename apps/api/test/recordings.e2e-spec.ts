import { randomUUID } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { request as httpRequest, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface RecordingResponse {
  id: string;
  meetingId: string;
  originalName: string;
  mimeType: string;
  kind: 'video' | 'audio';
  sizeBytes: number;
  durationSeconds: number | null;
  createdAt: string;
  uploaderEmail: string;
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
const MAX_BYTES = Number(process.env.RECORDINGS_MAX_BYTES);
const RECORDINGS_DIR = process.env.RECORDINGS_DIR as string;
const INCOMING_DIR = join(RECORDINGS_DIR, 'incoming');

const uniqueEmail = () => `user-${randomUUID()}@example.com`;

const fixture = (name: string): Buffer =>
  readFileSync(join(__dirname, 'fixtures', name));

// Files that belong to saved recordings, and files still being uploaded.
const storedFiles = () =>
  existsSync(RECORDINGS_DIR)
    ? readdirSync(RECORDINGS_DIR)
        .filter((name) => name !== 'incoming')
        .sort()
    : [];
const incomingFiles = () =>
  existsSync(INCOMING_DIR) ? readdirSync(INCOMING_DIR) : [];

const waitFor = async (check: () => boolean, timeoutMs = 3000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for the condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

// A missing route also answers 404 ("Cannot GET ..."), so check the body to be
// sure the 404 comes from the access check.
const expectMeetingNotFound = (body: unknown) => {
  expect(body).toMatchObject({ message: 'Meeting not found' });
};

describe('Recordings (e2e)', () => {
  let app: INestApplication<App>;

  const server = () => app.getHttpServer();

  // Listens on a real port: the aborted-upload test needs a raw socket.
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
      .send({
        title: 'Retro',
        date: '2026-11-01T10:00:00.000Z',
        participants,
      })
      .expect(201);
    return (res.body as { id: string }).id;
  };

  const upload = (
    user: TestUser | null,
    meetingId: string,
    { buffer, name, contentType }: Upload,
    durationSeconds?: string | number,
  ) => {
    const req = request(server()).post(`/meetings/${meetingId}/recordings`);
    if (user) {
      void req.auth(user.token, { type: 'bearer' });
    }
    if (durationSeconds !== undefined) {
      void req.field('durationSeconds', String(durationSeconds));
    }
    return req.attach('file', buffer, { filename: name, contentType });
  };

  const uploaded = async (
    user: TestUser,
    meetingId: string,
    file: Upload,
    durationSeconds?: number,
  ) => {
    const res = await upload(user, meetingId, file, durationSeconds).expect(
      201,
    );
    return res.body as RecordingResponse;
  };

  const listRecordings = (user: TestUser | null, meetingId: string) => {
    const req = request(server()).get(`/meetings/${meetingId}/recordings`);
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  // Rejected or aborted uploads must leave no row and no file behind.
  const expectNothingStored = async (
    owner: TestUser,
    meetingId: string,
    filesBefore: string[],
  ) => {
    await waitFor(() => incomingFiles().length === 0);
    expect(storedFiles()).toEqual(filesBefore);
    const res = await listRecordings(owner, meetingId).expect(200);
    expect(res.body).toEqual([]);
  };

  beforeAll(async () => {
    await startApp();
  });

  afterAll(async () => {
    await app.close();
    rmSync(RECORDINGS_DIR, { recursive: true, force: true });
  });

  describe('POST /meetings/:id/recordings', () => {
    it.each([
      ['sample.mp4', 'video/mp4', 'video'],
      ['sample.webm', 'video/webm', 'video'],
      ['sample.mp3', 'audio/mpeg', 'audio'],
      ['sample.m4a', 'audio/mp4', 'audio'],
      ['sample.wav', 'audio/wav', 'audio'],
    ])(
      'stores %s with MIME type %s and kind %s',
      async (name, mimeType, kind) => {
        const owner = await signUp();
        const meetingId = await createMeeting(owner);
        const buffer = fixture(name);
        const filesBefore = storedFiles();

        const recording = await uploaded(
          owner,
          meetingId,
          { buffer, name },
          12.5,
        );

        expect(recording).toEqual({
          id: expect.any(String) as string,
          meetingId,
          originalName: name,
          mimeType,
          kind,
          sizeBytes: buffer.length,
          durationSeconds: 12.5,
          createdAt: expect.any(String) as string,
          uploaderEmail: owner.email,
        });
        const newFiles = storedFiles().filter((f) => !filesBefore.includes(f));
        expect(newFiles).toHaveLength(1);
        expect(readFileSync(join(RECORDINGS_DIR, newFiles[0]))).toEqual(buffer);
        expect(incomingFiles()).toEqual([]);
      },
    );

    it('stores the duration as null when it is not sent (WebM without duration)', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);

      const recording = await uploaded(owner, meetingId, {
        buffer: fixture('no-duration.webm'),
        name: 'no-duration.webm',
      });

      expect(recording).toMatchObject({
        kind: 'video',
        mimeType: 'video/webm',
        durationSeconds: null,
      });
    });

    it('ignores the Content-Type sent by the client', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);

      const recording = await uploaded(owner, meetingId, {
        buffer: fixture('sample.mp3'),
        name: 'sample.mp3',
        contentType: 'text/html',
      });

      expect(recording.mimeType).toBe('audio/mpeg');
    });

    it('keeps a non-ASCII file name', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);

      const recording = await uploaded(owner, meetingId, {
        buffer: fixture('sample.mp3'),
        name: 'Зустріч команди.mp3',
      });

      expect(recording.originalName).toBe('Зустріч команди.mp3');
    });

    it.each([
      ['not a number', 'abc'],
      ['negative', -1],
      ['infinite', 'Infinity'],
    ])(
      'returns 400 when the duration is %s and stores nothing',
      async (_case, durationSeconds) => {
        const owner = await signUp();
        const meetingId = await createMeeting(owner);
        const filesBefore = storedFiles();

        await upload(
          owner,
          meetingId,
          { buffer: fixture('sample.mp3'), name: 'sample.mp3' },
          durationSeconds,
        ).expect(400);

        await expectNothingStored(owner, meetingId, filesBefore);
      },
    );

    it('returns 400 when no file is sent', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);

      const res = await request(server())
        .post(`/meetings/${meetingId}/recordings`)
        .auth(owner.token, { type: 'bearer' })
        .field('durationSeconds', '1')
        .expect(400);

      expect(res.body).toMatchObject({ message: 'File is required' });
    });

    it.each([
      [
        'an unsupported extension',
        { buffer: Buffer.from('hello'), name: 'notes.txt' },
      ],
      [
        'a WAV renamed to .mp4',
        {
          buffer: fixture('sample.wav'),
          name: 'renamed.mp4',
          contentType: 'video/mp4',
        },
      ],
      [
        'a text file renamed to .mp3',
        {
          buffer: Buffer.from('just some text, not audio\n'.repeat(20)),
          name: 'renamed.mp3',
          contentType: 'audio/mpeg',
        },
      ],
      [
        'an MP3 renamed to .webm',
        { buffer: fixture('sample.mp3'), name: 'renamed.webm' },
      ],
    ])('returns 415 for %s and stores nothing', async (_case, file: Upload) => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const filesBefore = storedFiles();

      const res = await upload(owner, meetingId, file).expect(415);

      expect(res.body).toMatchObject({
        message: 'Unsupported file format. Allowed: MP4, WebM, MP3, M4A, WAV',
      });
      await expectNothingStored(owner, meetingId, filesBefore);
    });

    it('returns 413 for a file over the size limit and stores nothing', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const filesBefore = storedFiles();
      const wav = fixture('sample.wav');
      const buffer = Buffer.concat([
        wav,
        Buffer.alloc(MAX_BYTES + 1 - wav.length),
      ]);

      const res = await upload(owner, meetingId, {
        buffer,
        name: 'big.wav',
      }).expect(413);

      expect(res.body).toMatchObject({
        message: 'File is larger than 32 KB',
      });
      await expectNothingStored(owner, meetingId, filesBefore);
    });

    it('accepts a file exactly at the size limit', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const wav = fixture('sample.wav');
      const buffer = Buffer.concat([wav, Buffer.alloc(MAX_BYTES - wav.length)]);

      const recording = await uploaded(owner, meetingId, {
        buffer,
        name: 'exact.wav',
      });

      expect(recording.sizeBytes).toBe(MAX_BYTES);
    });

    it('leaves no row or file behind when the upload is aborted', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const filesBefore = storedFiles();
      const boundary = `e2e-${randomUUID()}`;
      const head = Buffer.from(
        `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="file"; filename="partial.mp3"\r\n' +
          'Content-Type: audio/mpeg\r\n\r\n',
      );
      const { port } = (server() as Server).address() as AddressInfo;
      const req = httpRequest({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: `/meetings/${meetingId}/recordings`,
        headers: {
          authorization: `Bearer ${owner.token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': String(head.length + 20_000),
        },
      });
      req.on('error', () => {});
      req.on('response', (res) => res.resume());

      req.write(head);
      req.write(fixture('sample.mp3').subarray(0, 2000));
      // The api has started writing the file to disk; now drop the connection.
      await waitFor(() => incomingFiles().length === 1);
      req.destroy();

      await expectNothingStored(owner, meetingId, filesBefore);
    });

    describe('access', () => {
      const sample = () => ({
        buffer: fixture('sample.mp3'),
        name: 'sample.mp3',
      });

      it('returns 403 to an invited participant and stores nothing', async () => {
        const owner = await signUp();
        const guest = await signUp();
        const meetingId = await createMeeting(owner, [guest.email]);
        const filesBefore = storedFiles();

        const res = await upload(guest, meetingId, sample()).expect(403);

        expect(res.body).toMatchObject({
          message: 'Only the meeting owner can upload recordings',
        });
        await expectNothingStored(owner, meetingId, filesBefore);
      });

      it('returns 404 to a user who is not invited and stores nothing', async () => {
        const owner = await signUp();
        const stranger = await signUp();
        const meetingId = await createMeeting(owner);
        const filesBefore = storedFiles();

        const res = await upload(stranger, meetingId, sample()).expect(404);

        expectMeetingNotFound(res.body);
        await expectNothingStored(owner, meetingId, filesBefore);
      });

      it('returns 404 for an unknown meeting', async () => {
        const owner = await signUp();

        const res = await upload(owner, randomUUID(), sample()).expect(404);

        expectMeetingNotFound(res.body);
      });

      it('returns 404 when the meeting id is not a UUID', async () => {
        const owner = await signUp();

        const res = await upload(owner, 'not-a-uuid', sample()).expect(404);

        expectMeetingNotFound(res.body);
      });

      it('returns 401 without a token', async () => {
        const owner = await signUp();
        const meetingId = await createMeeting(owner);

        await upload(null, meetingId, sample()).expect(401);
      });
    });
  });

  describe('GET /meetings/:id/recordings', () => {
    it('returns an empty list for a meeting without recordings', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);

      const res = await listRecordings(owner, meetingId).expect(200);

      expect(res.body).toEqual([]);
    });

    it('lists recordings newest first with full metadata', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const created: RecordingResponse[] = [];
      for (let i = 0; i < 11; i++) {
        created.push(
          await uploaded(
            owner,
            meetingId,
            { buffer: fixture('sample.mp3'), name: `part-${i}.mp3` },
            i,
          ),
        );
      }

      const res = await listRecordings(owner, meetingId).expect(200);

      const recordings = res.body as RecordingResponse[];
      expect(recordings).toEqual([...created].reverse());
      const dates = recordings.map((r) => Date.parse(r.createdAt));
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });

    it('only lists recordings of the requested meeting', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const otherMeetingId = await createMeeting(owner);
      const recording = await uploaded(owner, meetingId, {
        buffer: fixture('sample.wav'),
        name: 'sample.wav',
      });
      await uploaded(owner, otherMeetingId, {
        buffer: fixture('sample.mp3'),
        name: 'sample.mp3',
      });

      const res = await listRecordings(owner, meetingId).expect(200);

      expect(res.body).toEqual([recording]);
    });

    it('lists recordings to an invited participant', async () => {
      const owner = await signUp();
      const guest = await signUp();
      const meetingId = await createMeeting(owner, [guest.email]);
      const recording = await uploaded(owner, meetingId, {
        buffer: fixture('sample.mp4'),
        name: 'sample.mp4',
      });

      const res = await listRecordings(guest, meetingId).expect(200);

      expect(res.body).toEqual([recording]);
    });

    it('returns 404 to a user who is not invited', async () => {
      const owner = await signUp();
      const stranger = await signUp();
      const meetingId = await createMeeting(owner);
      await uploaded(owner, meetingId, {
        buffer: fixture('sample.mp3'),
        name: 'sample.mp3',
      });

      const res = await listRecordings(stranger, meetingId).expect(404);

      expectMeetingNotFound(res.body);
    });

    it('returns 404 for an unknown meeting', async () => {
      const owner = await signUp();

      const res = await listRecordings(owner, randomUUID()).expect(404);

      expectMeetingNotFound(res.body);
    });

    it('returns 401 without a token', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);

      await listRecordings(null, meetingId).expect(401);
    });
  });

  describe('persistence', () => {
    it('keeps recordings and files after the api restarts', async () => {
      const owner = await signUp();
      const meetingId = await createMeeting(owner);
      const buffer = fixture('sample.m4a');
      const recording = await uploaded(owner, meetingId, {
        buffer,
        name: 'sample.m4a',
      });
      const files = storedFiles();

      await app.close();
      await startApp();

      const res = await listRecordings(owner, meetingId).expect(200);
      expect(res.body).toEqual([recording]);
      expect(storedFiles()).toEqual(files);
      const sizes = files.map((f) => statSync(join(RECORDINGS_DIR, f)).size);
      expect(sizes).toContain(buffer.length);
    });
  });
});
