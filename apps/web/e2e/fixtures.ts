import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { API_URL, FIXTURES_DIR } from './env';

export { expect };

export interface TestUser {
  email: string;
  token: string;
}

export interface TestMeeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
}

export interface TestRecording {
  id: string;
  originalName: string;
  durationSeconds: number | null;
}

// The password every test user signs up with.
export const PASSWORD = 'Str0ngPassw0rd!';

export const fixturePath = (name: string) => join(FIXTURES_DIR, name);
export const fixture = (name: string) => readFileSync(fixturePath(name));

async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  { token, json, form }: { token?: string; json?: unknown; form?: FormData },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Users, meetings and recordings are set up through the api directly, so each
// test only drives the UI it is about.
export async function signUp(): Promise<TestUser> {
  const email = `web-${randomUUID()}@example.com`;
  const { accessToken } = await api<{ accessToken: string }>(
    'POST',
    '/auth/register',
    { json: { email, password: PASSWORD } },
  );
  return { email, token: accessToken };
}

export function createMeeting(
  owner: TestUser,
  overrides: Partial<Omit<TestMeeting, 'id'>> = {},
): Promise<TestMeeting> {
  return api<TestMeeting>('POST', '/meetings', {
    token: owner.token,
    json: {
      title: `Design review ${randomUUID().slice(0, 8)}`,
      date: '2026-11-20T15:30:00.000Z',
      participants: [],
      ...overrides,
    },
  });
}

export function uploadRecording(
  owner: TestUser,
  meetingId: string,
  name: string,
  durationSeconds?: number,
): Promise<TestRecording> {
  const form = new FormData();
  if (durationSeconds !== undefined) {
    form.append('durationSeconds', String(durationSeconds));
  }
  form.append('file', new Blob([fixture(name)]), name);
  return api<TestRecording>('POST', `/meetings/${meetingId}/recordings`, {
    token: owner.token,
    form,
  });
}

export function listRecordings(
  user: TestUser,
  meetingId: string,
): Promise<TestRecording[]> {
  return api<TestRecording[]>('GET', `/meetings/${meetingId}/recordings`, {
    token: user.token,
  });
}

export function setName(user: TestUser, name: string | null): Promise<void> {
  return api<void>('PATCH', '/users/me', {
    token: user.token,
    json: { name },
  });
}

export interface TestProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export function getProfile(user: TestUser): Promise<TestProfile> {
  return api<TestProfile>('GET', '/users/me', { token: user.token });
}

export function uploadAvatar(
  user: TestUser,
  name: string,
): Promise<TestProfile> {
  const form = new FormData();
  form.append('file', new Blob([fixture(name)]), name);
  return api<TestProfile>('PUT', '/users/me/avatar', {
    token: user.token,
    form,
  });
}

export interface TestRecordingUrls {
  streamUrl: string;
  downloadUrl: string;
  expiresAt: string;
}

export function getRecordingUrls(
  user: TestUser,
  meetingId: string,
  recordingId: string,
): Promise<TestRecordingUrls> {
  return api<TestRecordingUrls>(
    'GET',
    `/meetings/${meetingId}/recordings/${recordingId}/urls`,
    { token: user.token },
  );
}

export function deleteRecording(
  owner: TestUser,
  meetingId: string,
  recordingId: string,
): Promise<void> {
  return api<void>(
    'DELETE',
    `/meetings/${meetingId}/recordings/${recordingId}`,
    { token: owner.token },
  );
}

// Signs the browser in the way the app does: the token in localStorage.
export async function signIn(page: Page, user: TestUser) {
  await page.addInitScript((token) => {
    localStorage.setItem('accessToken', token);
  }, user.token);
}

// Whether the api accepts these credentials, without touching the browser.
export async function canSignIn(
  user: TestUser,
  password: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password }),
  });
  if (res.status !== 200 && res.status !== 401) {
    throw new Error(`POST /auth/login → ${res.status} ${await res.text()}`);
  }
  return res.status === 200;
}

// Signs in through the login form, as a user would. Use it instead of
// `signIn` when the test signs out, since `signIn` restores the token on
// every page load.
export async function signInWithForm(
  page: Page,
  user: TestUser,
  password = PASSWORD,
) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

export async function openMeeting(
  page: Page,
  user: TestUser,
  meeting: TestMeeting,
) {
  await signIn(page, user);
  await page.goto(`/meetings/${meeting.id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: meeting.title }),
  ).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// Fails a test on any console error or uncaught exception. A test that causes
// an expected network error (404, aborted request) lists it in
// `allowConsoleErrors`.
export const test = base.extend<{
  allowConsoleErrors: RegExp[];
  failOnConsoleErrors: void;
}>({
  allowConsoleErrors: [[], { option: true }],
  failOnConsoleErrors: [
    async ({ page, allowConsoleErrors }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use();
      expect(
        errors.filter((e) => !allowConsoleErrors.some((re) => re.test(e))),
      ).toEqual([]);
    },
    { auto: true },
  ],
});
