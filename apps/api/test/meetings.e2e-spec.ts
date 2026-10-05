import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface MeetingResponse {
  id: string;
  title: string;
  date: string;
  participants: string[];
  ownerId: string;
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

const meetingInput = (overrides: object = {}) => ({
  title: 'Sprint planning',
  date: '2026-11-01T10:00:00.000Z',
  participants: [uniqueEmail(), uniqueEmail()],
  ...overrides,
});

// A missing route also answers 404 ("Cannot GET ..."), so check the body to be
// sure the 404 comes from the meetings handler.
const expectMeetingNotFound = (body: unknown) => {
  expect(body).toMatchObject({ message: 'Meeting not found' });
};

describe('Meetings (e2e)', () => {
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

  const createMeeting = (user: TestUser | null, body: object) => {
    const req = request(server()).post('/meetings').send(body);
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  const listMeetings = (user: TestUser | null) => {
    const req = request(server()).get('/meetings');
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  const getMeeting = (user: TestUser | null, id: string) => {
    const req = request(server()).get(`/meetings/${id}`);
    return user ? req.auth(user.token, { type: 'bearer' }) : req;
  };

  const createdMeeting = async (user: TestUser, body: object = {}) => {
    const res = await createMeeting(user, meetingInput(body)).expect(201);
    return res.body as MeetingResponse;
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

  describe('POST /meetings', () => {
    it('creates a meeting owned by the current user', async () => {
      const user = await signUp();
      const input = meetingInput();

      const res = await createMeeting(user, input).expect(201);

      const meeting = res.body as MeetingResponse;
      expect(meeting).toMatchObject({
        title: input.title,
        date: input.date,
        participants: input.participants,
        ownerId: user.id,
      });
      expect(typeof meeting.id).toBe('string');
    });

    it('accepts a meeting without participants', async () => {
      const user = await signUp();

      const res = await createMeeting(
        user,
        meetingInput({ participants: [] }),
      ).expect(201);

      expect((res.body as MeetingResponse).participants).toEqual([]);
    });

    it('returns 401 without a token', async () => {
      await createMeeting(null, meetingInput()).expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await request(server())
        .post('/meetings')
        .auth('not-a-jwt', { type: 'bearer' })
        .send(meetingInput())
        .expect(401);
    });

    it.each([
      ['title is missing', { title: undefined }],
      ['title is empty', { title: '' }],
      ['title is not a string', { title: 42 }],
      ['date is missing', { date: undefined }],
      ['date is not a date', { date: 'tomorrow' }],
      ['participants is missing', { participants: undefined }],
      ['participants is not an array', { participants: 'a@example.com' }],
      ['a participant is not an email', { participants: ['not-an-email'] }],
    ])('returns 400 when %s', async (_case, overrides) => {
      const user = await signUp();

      await createMeeting(user, meetingInput(overrides)).expect(400);
    });
  });

  describe('GET /meetings', () => {
    it("returns the current user's meetings", async () => {
      const user = await signUp();
      const first = await createdMeeting(user, { title: 'First' });
      const second = await createdMeeting(user, { title: 'Second' });

      const res = await listMeetings(user).expect(200);

      const meetings = res.body as MeetingResponse[];
      expect(meetings).toHaveLength(2);
      expect(meetings).toEqual(
        expect.arrayContaining([
          expect.objectContaining(first),
          expect.objectContaining(second),
        ]),
      );
    });

    it('returns an empty list for a user without meetings', async () => {
      const user = await signUp();

      const res = await listMeetings(user).expect(200);

      expect(res.body).toEqual([]);
    });

    it("does not include other users' meetings", async () => {
      const owner = await signUp();
      const stranger = await signUp();
      await createdMeeting(owner);

      const res = await listMeetings(stranger).expect(200);

      expect(res.body).toEqual([]);
    });

    it('includes meetings the user is invited to', async () => {
      const owner = await signUp();
      const guest = await signUp();
      const meeting = await createdMeeting(owner, {
        participants: [guest.email],
      });

      const res = await listMeetings(guest).expect(200);

      expect(res.body).toEqual([expect.objectContaining({ id: meeting.id })]);
    });

    it('returns 401 without a token', async () => {
      await listMeetings(null).expect(401);
    });
  });

  describe('GET /meetings/:id', () => {
    it('returns the meeting to its owner', async () => {
      const user = await signUp();
      const meeting = await createdMeeting(user);

      const res = await getMeeting(user, meeting.id).expect(200);

      expect(res.body).toEqual(meeting);
    });

    it('returns the meeting to an invited participant', async () => {
      const owner = await signUp();
      const guest = await signUp();
      const meeting = await createdMeeting(owner, {
        participants: [guest.email],
      });

      const res = await getMeeting(guest, meeting.id).expect(200);

      expect(res.body).toEqual(meeting);
    });

    it('returns 404 when the meeting does not exist', async () => {
      const user = await signUp();

      const res = await getMeeting(user, randomUUID()).expect(404);

      expectMeetingNotFound(res.body);
    });

    it('returns 404 when the id is not a UUID', async () => {
      const user = await signUp();

      const res = await getMeeting(user, 'not-a-uuid').expect(404);

      expectMeetingNotFound(res.body);
    });

    it("returns 404 for another user's meeting", async () => {
      const owner = await signUp();
      const stranger = await signUp();
      const meeting = await createdMeeting(owner);

      const res = await getMeeting(stranger, meeting.id).expect(404);

      expectMeetingNotFound(res.body);
    });

    it('returns 401 without a token', async () => {
      const user = await signUp();
      const meeting = await createdMeeting(user);

      await getMeeting(null, meeting.id).expect(401);
    });
  });
});
