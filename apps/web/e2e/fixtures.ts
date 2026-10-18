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

const PASSWORD = 'Str0ngPassw0rd!';

export const fixturePath = (name: string) => join(FIXTURES_DIR, name);
export const fixture = (name: string) => readFileSync(fixturePath(name));

async function api<T>(
  method: 'GET' | 'POST',
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
  return (await res.json()) as T;
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

// Signs the browser in the way the app does: the token in localStorage.
export async function signIn(page: Page, user: TestUser) {
  await page.addInitScript((token) => {
    localStorage.setItem('accessToken', token);
  }, user.token);
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
