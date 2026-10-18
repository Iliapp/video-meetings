import { readFileSync } from 'node:fs';
import type { Browser, Locator, Page, Route } from '@playwright/test';
import {
  API_URL,
  RECORDING_URL_TTL_SECONDS,
  RECORDINGS_MAX_BYTES,
} from './env';
import {
  createMeeting,
  deleteRecording,
  expect,
  expectNoHorizontalScroll,
  fixture,
  fixturePath,
  getRecordingUrls,
  listRecordings,
  openMeeting,
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
const GONE = 'This recording is no longer available';

const recordingsList = (page: Page) =>
  page.getByRole('list', { name: 'Recordings' });
const recordingItems = (page: Page) =>
  recordingsList(page).getByRole('listitem');
const uploadButton = (page: Page) =>
  page.getByRole('button', { name: 'Upload recording' });
const fileInput = (page: Page) => page.locator('input[type="file"]');
const recordingRow = (page: Page, name: string) =>
  recordingItems(page).filter({ hasText: name });
const playButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Play ${name}` });
const downloadButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Download ${name}` });
const deleteButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Delete ${name}` });
const deleteDialog = (page: Page) => page.getByRole('alertdialog');
const player = (page: Page, name: string, kind: 'video' | 'audio') =>
  recordingRow(page, name).locator(kind);
// Next.js adds its own role="alert" route announcer, so match by text.
const alertWith = (page: Page, text: string) =>
  page.getByRole('alert').filter({ hasText: text });
const uploadError = (page: Page) => alertWith(page, "Couldn't upload");

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
      // React Aria reads dropped files through webkitGetAsEntry(), which
      // Chrome only fills in for real drags from the OS; script-made files get
      // null. Report them as plain files, as a real drag would.
      const getAsEntry = DataTransferItem.prototype.webkitGetAsEntry;
      DataTransferItem.prototype.webkitGetAsEntry = function () {
        return (
          getAsEntry.call(this) ??
          (this.kind === 'file'
            ? ({ isFile: true, isDirectory: false } as FileSystemEntry)
            : null)
        );
      };
      const transfer = new DataTransfer();
      // A real drag from the OS allows copying; a new DataTransfer allows nothing.
      transfer.effectAllowed = 'all';
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

/** Waits until the element has played some of the file without an error. */
async function expectPlaying(media: Locator) {
  await expect(media).toBeVisible();
  await expect
    .poll(() =>
      media.evaluate((el: HTMLMediaElement) => ({
        error: el.error?.code ?? null,
        played: el.currentTime > 0 || el.ended,
      })),
    )
    .toEqual({ error: null, played: true });
}

async function guestPage(
  browser: Browser,
  guest: TestUser,
  meeting: TestMeeting,
) {
  const context = await browser.newContext({
    timezoneId: 'UTC',
    locale: 'en-US',
  });
  const page = await context.newPage();
  await openMeeting(page, guest, meeting);
  return page;
}

async function setupMeeting() {
  const owner = await signUp();
  const guest = await signUp();
  const meeting = await createMeeting(owner, { participants: [guest.email] });
  const mp4 = await uploadRecording(owner, meeting.id, 'sample.mp4', 1);
  const mp3 = await uploadRecording(owner, meeting.id, 'sample.mp3', 1);
  return { owner, guest, meeting, mp4, mp3 };
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

  test('shows the list to an invited user without upload or delete controls', async ({
    page,
  }) => {
    const { guest, meeting } = await setupMeeting();

    await openMeeting(page, guest, meeting);

    await expect(recordingItems(page)).toHaveCount(2);
    await expect(playButton(page, 'sample.mp4')).toBeVisible();
    await expect(downloadButton(page, 'sample.mp4')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
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

    await expect(uploadError(page)).toContainText(UNSUPPORTED_FORMAT);
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

    await expect(uploadError(page)).toContainText('File is larger than 64 KB');
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

      await expect(uploadError(page)).toContainText(UPLOAD_FAILED);
      await expect(page.getByText('No recordings yet')).toBeVisible();
      expect(await listRecordings(owner, meeting.id)).toEqual([]);

      await page.getByRole('button', { name: 'Retry' }).click();

      await expect(recordingItems(page)).toHaveCount(1);
      await expect(recordingItems(page)).toContainText('sample.mp3');
      await expect(uploadError(page)).toHaveCount(0);
    });
  });
});

test.describe('upload while the list failed to load', () => {
  test.use({ allowConsoleErrors: [/ERR_FAILED/] });

  test('reloads the list, so the new recording shows', async ({ page }) => {
    const owner = await signUp();
    const meeting = await createMeeting(owner);
    let listFailed = false;
    await page.route(
      `${API_URL}/meetings/${meeting.id}/recordings`,
      (route) => {
        if (route.request().method() === 'GET' && !listFailed) {
          listFailed = true;
          return route.abort('failed');
        }
        return route.continue();
      },
    );
    await openMeeting(page, owner, meeting);
    await expect(page.getByText("Couldn't load recordings")).toBeVisible();

    await fileInput(page).setInputFiles(fixturePath('sample.mp3'));

    await expect(recordingItems(page)).toHaveCount(1);
    await expect(recordingItems(page)).toContainText('sample.mp3');
  });
});

test.describe('play and download', () => {
  for (const role of ['owner', 'guest'] as const) {
    test(`the ${role} plays an MP4 and an MP3 in the page and downloads a byte-identical file`, async ({
      page,
    }) => {
      const { owner, guest, meeting } = await setupMeeting();
      await openMeeting(page, role === 'owner' ? owner : guest, meeting);

      await playButton(page, 'sample.mp4').click();
      const video = player(page, 'sample.mp4', 'video');
      await expectPlaying(video);
      expect(
        await video.evaluate((el: HTMLVideoElement) => el.videoWidth),
      ).toBeGreaterThan(0);

      await playButton(page, 'sample.mp3').click();
      await expectPlaying(player(page, 'sample.mp3', 'audio'));
      // One player at a time.
      await expect(video).toHaveCount(0);

      const downloadEvent = page.waitForEvent('download');
      await downloadButton(page, 'sample.mp4').click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe('sample.mp4');
      expect(
        readFileSync(await download.path()).equals(fixture('sample.mp4')),
      ).toBe(true);
    });
  }

  test.describe(() => {
    test.use({ allowConsoleErrors: [/status of 404/] });

    test('keeps playing from the same position after the URL expires', async ({
      page,
    }) => {
      const { owner, meeting } = await setupMeeting();
      await openMeeting(page, owner, meeting);
      await playButton(page, 'sample.mp4').click();
      const video = player(page, 'sample.mp4', 'video');
      await expectPlaying(video);
      await video.evaluate(async (el: HTMLMediaElement) => {
        el.pause();
        el.currentTime = 0.5;
        await new Promise((resolve) =>
          el.addEventListener('seeked', resolve, { once: true }),
        );
      });
      const oldSrc = await video.evaluate((el: HTMLMediaElement) => el.src);

      await page.waitForTimeout((RECORDING_URL_TTL_SECONDS + 1) * 1000);
      // The browser asks for the file again with the expired token → 404, as
      // when seeking past the buffer of a long recording. Chrome reuses a
      // loaded resource for the same URL, so add a parameter.
      await video.evaluate((el: HTMLMediaElement) => {
        el.src = `${el.src}&reload=1`;
      });

      await expect
        .poll(() =>
          video.evaluate(
            (el: HTMLMediaElement, oldSrc) => ({
              error: el.error?.code ?? null,
              ready: el.readyState >= HTMLMediaElement.HAVE_METADATA,
              newSrc: el.src !== '' && el.src !== oldSrc,
              position: Math.round(el.currentTime * 10) / 10,
            }),
            oldSrc,
          ),
        )
        .toEqual({ error: null, ready: true, newSrc: true, position: 0.5 });
      await expect(alertWith(page, GONE)).toHaveCount(0);
    });
  });
});

test.describe('delete', () => {
  test.use({ allowConsoleErrors: [/status of 404/] });

  test('confirmed delete removes the recording for both users, and old links return "not found"', async ({
    page,
    browser,
    request,
  }) => {
    const { owner, guest, meeting, mp4 } = await setupMeeting();
    const urls = await getRecordingUrls(owner, meeting.id, mp4.id);
    await openMeeting(page, owner, meeting);
    await expect(recordingItems(page)).toHaveCount(2);

    await deleteButton(page, 'sample.mp4').click();
    const dialog = deleteDialog(page);
    await expect(dialog).toContainText('sample.mp4');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(recordingItems(page)).toHaveCount(1);
    await expect(recordingRow(page, 'sample.mp4')).toHaveCount(0);
    await expect(recordingItems(page)).toContainText('sample.mp3');

    const guestView = await guestPage(browser, guest, meeting);
    await expect(recordingItems(guestView)).toHaveCount(1);
    await expect(recordingRow(guestView, 'sample.mp4')).toHaveCount(0);
    await guestView.context().close();

    expect((await request.get(urls.streamUrl)).status()).toBe(404);
    expect((await request.get(urls.downloadUrl)).status()).toBe(404);
  });

  test('cancelled delete keeps the recording', async ({ page }) => {
    const { owner, meeting } = await setupMeeting();
    await openMeeting(page, owner, meeting);

    await deleteButton(page, 'sample.mp4').click();
    await deleteDialog(page).getByRole('button', { name: 'Cancel' }).click();

    await expect(deleteDialog(page)).toHaveCount(0);
    await expect(recordingItems(page)).toHaveCount(2);
    await expect(recordingRow(page, 'sample.mp4')).toHaveCount(1);
    expect(await listRecordings(owner, meeting.id)).toHaveLength(2);
  });

  test.describe(() => {
    test.use({ allowConsoleErrors: [/ERR_FAILED/] });

    test('shows an error when the delete fails, and keeps the recording', async ({
      page,
    }) => {
      const { owner, meeting, mp4 } = await setupMeeting();
      await openMeeting(page, owner, meeting);
      await page.route(
        `${API_URL}/meetings/${meeting.id}/recordings/${mp4.id}`,
        (route) =>
          route.request().method() === 'DELETE'
            ? route.abort('failed')
            : route.continue(),
      );

      await deleteButton(page, 'sample.mp4').click();
      await deleteDialog(page).getByRole('button', { name: 'Delete' }).click();

      await expect(alertWith(page, "Couldn't delete sample.mp4")).toBeVisible();
      await expect(recordingRow(page, 'sample.mp4')).toHaveCount(1);
      expect(await listRecordings(owner, meeting.id)).toHaveLength(2);
    });
  });
});

test.describe('a recording that was already deleted', () => {
  test.use({ allowConsoleErrors: [/status of 404/] });

  for (const action of ['play', 'download', 'delete'] as const) {
    test(`shows a clear message on ${action} and refreshes the list`, async ({
      page,
    }) => {
      const { owner, meeting, mp4 } = await setupMeeting();
      await openMeeting(page, owner, meeting);
      await expect(recordingItems(page)).toHaveCount(2);
      await deleteRecording(owner, meeting.id, mp4.id);

      if (action === 'play') {
        await playButton(page, 'sample.mp4').click();
      } else if (action === 'download') {
        await downloadButton(page, 'sample.mp4').click();
      } else {
        await deleteButton(page, 'sample.mp4').click();
        await deleteDialog(page)
          .getByRole('button', { name: 'Delete' })
          .click();
      }

      await expect(alertWith(page, GONE)).toBeVisible();
      await expect(recordingItems(page)).toHaveCount(1);
      await expect(recordingRow(page, 'sample.mp4')).toHaveCount(0);
    });
  }
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

      await playButton(page, 'sample.mp4').click();
      await expectPlaying(player(page, 'sample.mp4', 'video'));
      await expectNoHorizontalScroll(page);

      await deleteButton(page, 'sample.m4a').click();
      await expect(deleteDialog(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});
