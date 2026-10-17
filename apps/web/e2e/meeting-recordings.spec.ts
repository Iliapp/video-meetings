import type { Page, Route } from '@playwright/test';
import { API_URL, RECORDINGS_MAX_BYTES } from './env';
import {
  createMeeting,
  expect,
  expectNoHorizontalScroll,
  fixture,
  fixturePath,
  listRecordings,
  signIn,
  signUp,
  test,
  uploadRecording,
  type TestMeeting,
  type TestUser,
} from './fixtures';

const UNSUPPORTED_FORMAT =
  'Unsupported file format. Allowed: MP4, WebM, MP3, M4A, WAV';
const UPLOAD_FAILED = 'Upload failed. Check your connection and try again.';

const recordingsList = (page: Page) =>
  page.getByRole('list', { name: 'Recordings' });
const recordingItems = (page: Page) =>
  recordingsList(page).getByRole('listitem');
const uploadButton = (page: Page) =>
  page.getByRole('button', { name: 'Upload recording' });
const fileInput = (page: Page) => page.locator('input[type="file"]');

async function openMeeting(page: Page, user: TestUser, meeting: TestMeeting) {
  await signIn(page, user);
  await page.goto(`/meetings/${meeting.id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: meeting.title }),
  ).toBeVisible();
}

// Marks the window, so a test can check that the page was not reloaded.
async function markWindow(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { e2eMark: boolean }).e2eMark = true;
  });
}
async function expectSameWindow(page: Page) {
  expect(
    await page.evaluate(
      () => (window as unknown as { e2eMark?: boolean }).e2eMark,
    ),
  ).toBe(true);
}

// Holds the upload request until `release()` is called, so the in-progress
// state can be seen and cancelled.
async function holdUpload(page: Page, meeting: TestMeeting) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let held: Route | undefined;
  await page.route(`${API_URL}/meetings/${meeting.id}/recordings`, (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    held = route;
    return released.then(() => route.continue().catch(() => {}));
  });
  return {
    release,
    isHeld: () => held !== undefined,
  };
}

async function dropFile(page: Page, name: string, type: string) {
  const dataTransfer = await page.evaluateHandle(
    ({ base64, name, type }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type }));
      return transfer;
    },
    { base64: fixture(name).toString('base64'), name, type },
  );
  const zone = page.getByTestId('recording-dropzone');
  await zone.dispatchEvent('dragenter', { dataTransfer });
  await zone.dispatchEvent('dragover', { dataTransfer });
  await zone.dispatchEvent('drop', { dataTransfer });
}

test.describe('meeting page', () => {
  test('opens from the dashboard and shows the meeting details', async ({
    page,
  }) => {
    const owner = await signUp();
    const guest = await signUp();
    const meeting = await createMeeting(owner, {
      participants: [guest.email],
    });
    await signIn(page, owner);

    await page.goto('/');
    await page.getByRole('link', { name: meeting.title }).click();

    await expect(page).toHaveURL(`/meetings/${meeting.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: meeting.title }),
    ).toBeVisible();
    await expect(page.getByText('November 20, 2026')).toBeVisible();
    const participants = page.getByRole('list', { name: 'Participants' });
    await expect(participants).toContainText(owner.email);
    await expect(participants).toContainText(guest.email);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Recordings' }),
    ).toBeVisible();
  });

  test('shows an empty state with an upload action for the owner', async ({
    page,
  }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);

    await openMeeting(page, owner, meeting);

    await expect(page.getByText('No recordings yet')).toBeVisible();
    await expect(uploadButton(page)).toBeVisible();
  });

  test('lists recordings newest first with their details', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await uploadRecording(owner, meeting.id, 'sample.mp4', 12.5);
    await uploadRecording(owner, meeting.id, 'sample.mp3');

    await openMeeting(page, owner, meeting);

    const items = recordingItems(page);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('sample.mp3');
    await expect(items.nth(0)).toContainText('Audio');
    await expect(items.nth(0)).toContainText('4.3 KB');
    await expect(items.nth(0)).toContainText('—');
    await expect(items.nth(0)).toContainText(owner.email);
    await expect(items.nth(1)).toContainText('sample.mp4');
    await expect(items.nth(1)).toContainText('Video');
    await expect(items.nth(1)).toContainText('12.4 KB');
    await expect(items.nth(1)).toContainText('0:13');
  });

  test('shows the list to an invited user without upload controls', async ({
    page,
  }) => {
    const owner = await signUp();
    const guest = await signUp();
    const meeting = await createMeeting(owner, {
      participants: [guest.email],
    });
    await uploadRecording(owner, meeting.id, 'sample.wav', 1);

    await openMeeting(page, guest, meeting);

    await expect(recordingItems(page)).toHaveCount(1);
    await expect(recordingItems(page)).toContainText('sample.wav');
    await expect(uploadButton(page)).toHaveCount(0);
    await expect(fileInput(page)).toHaveCount(0);
    await expect(page.getByTestId('recording-dropzone')).toHaveCount(0);
  });

  test.describe(() => {
    test.use({ allowConsoleErrors: [/status of 404/] });

    test('shows "not found" to a user who is not invited', async ({ page }) => {
      const owner = await signUp();
      const stranger = await signUp();
      const meeting = await createMeeting(owner);
      await signIn(page, stranger);

      await page.goto(`/meetings/${meeting.id}`);

      await expect(
        page.getByRole('heading', { name: 'Meeting not found' }),
      ).toBeVisible();
      await expect(page.getByText(meeting.title)).toHaveCount(0);
    });
  });
});

test.describe('upload', () => {
  test('uploads with the file picker and adds it to the list without a reload', async ({
    page,
  }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await openMeeting(page, owner, meeting);
    await markWindow(page);

    await fileInput(page).setInputFiles(fixturePath('sample.mp4'));

    await expect(recordingItems(page)).toHaveCount(1);
    await expect(recordingItems(page)).toContainText('sample.mp4');
    await expect(recordingItems(page)).toContainText('0:01');
    await expectSameWindow(page);
  });

  test('uploads by drag and drop', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await openMeeting(page, owner, meeting);

    await dropFile(page, 'sample.mp3', 'audio/mpeg');

    await expect(recordingItems(page)).toHaveCount(1);
    await expect(recordingItems(page)).toContainText('sample.mp3');
  });

  test('shows "—" for a WebM without duration', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await openMeeting(page, owner, meeting);

    await fileInput(page).setInputFiles(fixturePath('no-duration.webm'));

    await expect(recordingItems(page)).toHaveCount(1);
    await expect(recordingItems(page)).toContainText('no-duration.webm');
    await expect(recordingItems(page)).toContainText('—');
    const [recording] = await listRecordings(owner, meeting.id);
    expect(recording.durationSeconds).toBeNull();
  });

  test('shows progress, then the recording', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await openMeeting(page, owner, meeting);
    const upload = await holdUpload(page, meeting);

    await fileInput(page).setInputFiles(fixturePath('sample.wav'));

    await expect(
      page.getByRole('progressbar', { name: /Uploading sample\.wav/ }),
    ).toBeVisible();
    expect(upload.isHeld()).toBe(true);
    upload.release();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(recordingItems(page)).toContainText('sample.wav');
  });

  test('cancel adds nothing to the list', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await openMeeting(page, owner, meeting);
    const upload = await holdUpload(page, meeting);

    await fileInput(page).setInputFiles(fixturePath('sample.wav'));
    await expect(page.getByRole('progressbar')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel upload' }).click();
    upload.release();

    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.getByText('No recordings yet')).toBeVisible();
    await expect(recordingsList(page)).toHaveCount(0);
    expect(await listRecordings(owner, meeting.id)).toEqual([]);
  });

  test('names the reason for an unsupported format', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await openMeeting(page, owner, meeting);

    await fileInput(page).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a recording'),
    });

    await expect(page.getByRole('alert')).toContainText(UNSUPPORTED_FORMAT);
    await expect(page.getByText('No recordings yet')).toBeVisible();
    expect(await listRecordings(owner, meeting.id)).toEqual([]);
  });

  test('names the reason for a file over the size limit', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    await openMeeting(page, owner, meeting);
    const wav = fixture('sample.wav');

    await fileInput(page).setInputFiles({
      name: 'big.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.concat([
        wav,
        Buffer.alloc(RECORDINGS_MAX_BYTES + 1 - wav.length),
      ]),
    });

    await expect(page.getByRole('alert')).toContainText(
      'File is larger than 64 KB',
    );
    expect(await listRecordings(owner, meeting.id)).toEqual([]);
  });

  test.describe(() => {
    test.use({ allowConsoleErrors: [/ERR_FAILED/] });

    test('shows an error when the upload fails, and retry works', async ({
      page,
    }) => {
      const owner = await signUp();
      const meeting = await createMeeting(owner);
      await openMeeting(page, owner, meeting);
      let failed = false;
      await page.route(
        `${API_URL}/meetings/${meeting.id}/recordings`,
        (route) => {
          if (route.request().method() === 'POST' && !failed) {
            failed = true;
            return route.abort('failed');
          }
          return route.continue();
        },
      );

      await fileInput(page).setInputFiles(fixturePath('sample.mp3'));

      await expect(page.getByRole('alert')).toContainText(UPLOAD_FAILED);
      await expect(page.getByText('No recordings yet')).toBeVisible();
      expect(await listRecordings(owner, meeting.id)).toEqual([]);

      await page.getByRole('button', { name: 'Retry' }).click();

      await expect(recordingItems(page)).toHaveCount(1);
      await expect(recordingItems(page)).toContainText('sample.mp3');
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  });
});

test.describe('layout', () => {
  for (const width of [375, 1440, 1920]) {
    test(`has no horizontal scroll at ${width} px`, async ({ page }) => {
      const owner = await signUp();
      const guest = await signUp();
      const meeting = await createMeeting(owner, {
        title: 'Quarterly planning with a rather long meeting title',
        participants: [guest.email],
      });
      await uploadRecording(owner, meeting.id, 'sample.mp4', 3725);
      await uploadRecording(owner, meeting.id, 'sample.m4a');
      await page.setViewportSize({ width, height: 900 });

      await openMeeting(page, owner, meeting);

      await expect(recordingItems(page)).toHaveCount(2);
      await expectNoHorizontalScroll(page);
    });
  }
});
