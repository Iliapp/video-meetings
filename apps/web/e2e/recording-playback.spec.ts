import { readFileSync } from 'node:fs';
import type { Browser, Locator, Page } from '@playwright/test';
import { API_URL, RECORDING_URL_TTL_SECONDS } from './env';
import {
  createMeeting,
  deleteRecording,
  expect,
  expectNoHorizontalScroll,
  fixture,
  getRecordingUrls,
  listRecordings,
  openMeeting,
  signUp,
  test,
  uploadRecording,
  type TestMeeting,
  type TestUser,
} from './fixtures';

const GONE = 'This recording is no longer available';

const recordingItems = (page: Page) =>
  page.getByRole('list', { name: 'Recordings' }).getByRole('listitem');
const recordingRow = (page: Page, name: string) =>
  recordingItems(page).filter({ hasText: name });
const playButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Play ${name}` });
const downloadButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Download ${name}` });
const deleteButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Delete ${name}` });
const deleteDialog = (page: Page) => page.getByRole('alertdialog');
// Next.js adds its own role="alert" route announcer, so match by text.
const alertWith = (page: Page, text: string) =>
  page.getByRole('alert').filter({ hasText: text });

function player(page: Page, name: string, kind: 'video' | 'audio') {
  return recordingRow(page, name).locator(kind);
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

test.describe('play', () => {
  for (const role of ['owner', 'guest'] as const) {
    test(`the ${role} plays an MP4 and an MP3 in the page`, async ({
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
      // The browser asks for the file again with the expired URL → 404.
      await video.evaluate((el: HTMLMediaElement) => el.load());

      await expect
        .poll(() =>
          video.evaluate((el: HTMLMediaElement) => ({
            error: el.error?.code ?? null,
            ready: el.readyState >= HTMLMediaElement.HAVE_METADATA,
            newSrc: el.src !== '' && el.src !== oldSrc,
            position: Math.round(el.currentTime * 10) / 10,
          })),
        )
        .toEqual({ error: null, ready: true, newSrc: true, position: 0.5 });
      await expect(alertWith(page, GONE)).toHaveCount(0);
    });
  });
});

test.describe('download', () => {
  for (const role of ['owner', 'guest'] as const) {
    test(`the ${role} downloads a byte-identical file`, async ({ page }) => {
      const { owner, guest, meeting } = await setupMeeting();
      await openMeeting(page, role === 'owner' ? owner : guest, meeting);

      const downloadEvent = page.waitForEvent('download');
      await downloadButton(page, 'sample.mp4').click();
      const download = await downloadEvent;

      expect(download.suggestedFilename()).toBe('sample.mp4');
      const path = await download.path();
      expect(readFileSync(path).equals(fixture('sample.mp4'))).toBe(true);
    });
  }
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

  test('the invited user sees no delete control', async ({ page }) => {
    const { guest, meeting } = await setupMeeting();
    await openMeeting(page, guest, meeting);

    await expect(recordingItems(page)).toHaveCount(2);
    await expect(playButton(page, 'sample.mp4')).toBeVisible();
    await expect(downloadButton(page, 'sample.mp4')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
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

test.describe('layout with the player open', () => {
  for (const width of [375, 1440, 1920]) {
    test(`has no horizontal scroll at ${width} px`, async ({ page }) => {
      const { owner, meeting } = await setupMeeting();
      await page.setViewportSize({ width, height: 900 });
      await openMeeting(page, owner, meeting);

      await playButton(page, 'sample.mp4').click();
      await expectPlaying(player(page, 'sample.mp4', 'video'));
      await expectNoHorizontalScroll(page);

      await deleteButton(page, 'sample.mp3').click();
      await expect(deleteDialog(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});
