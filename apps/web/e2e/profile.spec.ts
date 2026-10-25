import type { Locator, Page, Request, Route } from '@playwright/test';
import { API_URL, AVATAR_MAX_BYTES, WEB_URL } from './env';
import {
  expect,
  expectNoHorizontalScroll,
  fixture,
  fixturePath,
  getProfile,
  setName,
  signIn,
  signInWithForm,
  signUp,
  test,
  uploadAvatar,
  type TestUser,
} from './fixtures';

const NAME_TOO_LONG = 'Name must be 100 characters or fewer';
const AVATAR_UNSUPPORTED = 'Unsupported file format. Allowed: JPG, PNG, WebP';
const AVATAR_TOO_LARGE = 'File is larger than 16 KB';
const AVATAR_UPLOAD_FAILED =
  'Upload failed. Check your connection and try again.';
const AVATAR_ENDPOINT = `${API_URL}/users/me/avatar`;

const header = (page: Page) => page.getByRole('banner');
// The header link to /profile is named by what it shows: the name, or the
// email when there is no name.
const profileLink = (page: Page, label: string) =>
  header(page).getByRole('link', { name: label });
const headerAvatar = (page: Page) => header(page).getByTestId('avatar');
const pageAvatar = (page: Page) => page.getByRole('main').getByTestId('avatar');
const greeting = (page: Page) => page.getByRole('heading', { level: 1 });
const emailInput = (page: Page) =>
  page.getByRole('main').getByRole('textbox', { name: 'Email' });
const nameInput = (page: Page) => page.getByRole('textbox', { name: 'Name' });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save' });
const success = (page: Page) => page.getByText('Profile updated');
const avatarInput = (page: Page) =>
  page.getByRole('main').locator('input[type="file"]');
const uploadPhotoButton = (page: Page) =>
  page.getByRole('button', { name: 'Upload photo' });
const changePhotoButton = (page: Page) =>
  page.getByRole('button', { name: 'Change photo' });
const removePhotoButton = (page: Page) =>
  page.getByRole('button', { name: 'Remove photo' });
const removeDialog = (page: Page) =>
  page.getByRole('alertdialog', { name: 'Remove photo?' });
// Next.js adds its own role="alert" route announcer, so match by text.
const alertWith = (page: Page, text: string) =>
  page.getByRole('alert').filter({ hasText: text });
const avatarError = (page: Page) => alertWith(page, "Couldn't upload photo");
const tryAgainButton = (page: Page) =>
  page.getByRole('button', { name: 'Try again' });

// The email's first letter, as the initials of a user without a name.
const emailInitial = (user: TestUser) => user.email[0].toUpperCase();

async function openProfile(page: Page, user: TestUser) {
  await signIn(page, user);
  await page.goto('/profile');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Profile' }),
  ).toBeVisible();
}

// Records the PATCH /users/me requests the page sends.
function watchProfileUpdates(page: Page) {
  const sent: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url() === `${API_URL}/users/me`)
      sent.push(request);
  });
  return sent;
}

// Records the PUT /users/me/avatar requests the page sends.
function watchAvatarUploads(page: Page) {
  const sent: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url() === AVATAR_ENDPOINT)
      sent.push(request);
  });
  return sent;
}

// Holds the `method` requests to `url` until `release()` is called, so the
// in-progress state can be seen and other requests can finish first.
async function holdRequests(page: Page, url: string, method: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let held: Route | undefined;
  await page.route(url, (route) => {
    if (route.request().method() !== method) return route.continue();
    held = route;
    return released.then(() => route.continue().catch(() => {}));
  });
  return { release, isHeld: () => held !== undefined };
}
const holdAvatarUpload = (page: Page) =>
  holdRequests(page, AVATAR_ENDPOINT, 'PUT');
const holdNameSave = (page: Page) =>
  holdRequests(page, `${API_URL}/users/me`, 'PATCH');

// The avatar shows the image only once it has loaded (Radix Avatar renders the
// <img> then and drops the initials).
async function expectAvatarImage(avatar: Locator, src: string | RegExp) {
  await expect(avatar.locator('img')).toHaveAttribute('src', src);
}
async function expectInitials(avatar: Locator, initials: string) {
  await expect(avatar).toHaveText(initials);
  await expect(avatar.locator('img')).toHaveCount(0);
}

async function avatarUrlOf(user: TestUser): Promise<string> {
  const { avatarUrl } = await getProfile(user);
  expect(avatarUrl).not.toBeNull();
  return avatarUrl!;
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

// Presses Tab until the target has focus, so a test proves it is reachable
// by keyboard.
async function tabTo(page: Page, target: Locator, maxTabs = 30) {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Not reachable with Tab in ${maxTabs} presses`);
}

test.describe('access', () => {
  test('a signed-out user is redirected to /login', async ({ page }) => {
    await page.goto('/profile');

    await expect(page).toHaveURL('/login');
  });

  test('the header shows initials and the email and links to /profile', async ({
    page,
  }) => {
    const user = await signUp();
    await signIn(page, user);

    await page.goto('/');

    await expect(headerAvatar(page)).toHaveText(emailInitial(user));
    const link = profileLink(page, user.email);
    await expect(link).toHaveAttribute('href', '/profile');

    await link.click();

    await expect(page).toHaveURL('/profile');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Profile' }),
    ).toBeVisible();
  });
});

test.describe('profile page', () => {
  test('shows the email read-only and an empty name field', async ({
    page,
  }) => {
    const user = await signUp();

    await openProfile(page, user);

    await expect(emailInput(page)).toHaveValue(user.email);
    await expect(emailInput(page)).not.toBeEditable();
    await expect(nameInput(page)).toHaveValue('');
    await expect(nameInput(page)).toBeEditable();
    await expect(pageAvatar(page)).toHaveText(emailInitial(user));
  });

  test('shows the saved name', async ({ page }) => {
    const user = await signUp();
    await setName(user, 'Ann Lee');

    await openProfile(page, user);

    await expect(nameInput(page)).toHaveValue('Ann Lee');
    await expect(pageAvatar(page)).toHaveText('AL');
    await expect(profileLink(page, 'Ann Lee')).toBeVisible();
  });

  test('saving a name updates the header and greeting without a reload', async ({
    page,
  }) => {
    const user = await signUp();
    await openProfile(page, user);
    await markWindow(page);

    await nameInput(page).fill('  Ann Lee  ');
    await saveButton(page).click();

    await expect(success(page)).toBeVisible();
    await expect(nameInput(page)).toHaveValue('Ann Lee');
    await expect(profileLink(page, 'Ann Lee')).toBeVisible();
    await expect(headerAvatar(page)).toHaveText('AL');
    await expect(pageAvatar(page)).toHaveText('AL');

    // The logo goes home inside the app, so the greeting must already know.
    await header(page)
      .getByRole('link', { name: /video meetings/i })
      .click();

    await expect(page).toHaveURL('/');
    await expect(greeting(page)).toHaveText('Ann Lee');
    await expectSameWindow(page);
  });

  test('the name persists after signing out and in', async ({ page }) => {
    const user = await signUp();
    await signInWithForm(page, user);
    await profileLink(page, user.email).click();
    await nameInput(page).fill('Ann Lee');
    await saveButton(page).click();
    await expect(success(page)).toBeVisible();

    await header(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
    await signInWithForm(page, user);

    await expect(greeting(page)).toHaveText('Ann Lee');
    await expect(headerAvatar(page)).toHaveText('AL');
    await profileLink(page, 'Ann Lee').click();
    await expect(nameInput(page)).toHaveValue('Ann Lee');
  });

  for (const [label, value] of [
    ['empty', ''],
    ['whitespace-only', '   '],
  ] as const) {
    test(`clearing the name (${label}) falls back to the email`, async ({
      page,
    }) => {
      const user = await signUp();
      await setName(user, 'Ann Lee');
      await openProfile(page, user);
      const sent = watchProfileUpdates(page);

      await nameInput(page).fill(value);
      await saveButton(page).click();

      await expect(success(page)).toBeVisible();
      expect(sent).toHaveLength(1);
      expect(sent[0].postDataJSON()).toEqual({ name: null });
      await expect(profileLink(page, user.email)).toBeVisible();
      await expect(headerAvatar(page)).toHaveText(emailInitial(user));

      await page.goto('/');

      await expect(greeting(page)).toHaveText(user.email);
    });
  }

  test('a name over 100 characters shows a field error and sends no request', async ({
    page,
  }) => {
    const user = await signUp();
    await setName(user, 'Ann Lee');
    await openProfile(page, user);
    const sent = watchProfileUpdates(page);

    await nameInput(page).fill('a'.repeat(101));
    await saveButton(page).click();

    await expect(page.getByText(NAME_TOO_LONG)).toBeVisible();
    await expect(nameInput(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(success(page)).toHaveCount(0);
    expect(sent).toHaveLength(0);
    await expect(profileLink(page, 'Ann Lee')).toBeVisible();

    // Exactly 100 characters is allowed.
    await nameInput(page).fill('a'.repeat(100));
    await saveButton(page).click();

    await expect(success(page)).toBeVisible();
    await expect(page.getByText(NAME_TOO_LONG)).toHaveCount(0);
    expect(sent).toHaveLength(1);
  });
});

test.describe('avatar upload', () => {
  for (const file of ['avatar.jpg', 'avatar.png', 'avatar.webp']) {
    test(`uploading ${file} shows a preview, then the avatar in the profile and header`, async ({
      page,
    }) => {
      const user = await signUp();
      await openProfile(page, user);
      await markWindow(page);
      await expectInitials(pageAvatar(page), emailInitial(user));
      await expect(removePhotoButton(page)).toHaveCount(0);
      const upload = await holdAvatarUpload(page);

      await avatarInput(page).setInputFiles(fixturePath(file));

      // The picked file shows while it uploads, but not yet in the header.
      await expect.poll(upload.isHeld).toBe(true);
      await expectAvatarImage(pageAvatar(page), /^blob:/);
      await expect(uploadPhotoButton(page)).toBeDisabled();
      await expectInitials(headerAvatar(page), emailInitial(user));

      upload.release();

      await expect(changePhotoButton(page)).toBeEnabled();
      const avatarUrl = await avatarUrlOf(user);
      expect(avatarUrl.startsWith(`${API_URL}/avatars/`)).toBe(true);
      await expectAvatarImage(pageAvatar(page), avatarUrl);
      await expectAvatarImage(headerAvatar(page), avatarUrl);
      await expect(removePhotoButton(page)).toBeVisible();
      await expect(avatarError(page)).toHaveCount(0);

      // Every signed-in page's header shows it.
      await header(page)
        .getByRole('link', { name: /video meetings/i })
        .click();
      await expect(page).toHaveURL('/');
      await expectAvatarImage(headerAvatar(page), avatarUrl);
      await expectSameWindow(page);
    });
  }

  test('a new upload replaces the avatar', async ({ page }) => {
    const user = await signUp();
    const { avatarUrl: oldUrl } = await uploadAvatar(user, 'avatar.png');
    await openProfile(page, user);
    await expectAvatarImage(pageAvatar(page), oldUrl!);

    await avatarInput(page).setInputFiles(fixturePath('avatar.jpg'));

    await expect(pageAvatar(page).locator('img')).not.toHaveAttribute(
      'src',
      oldUrl!,
    );
    const newUrl = await avatarUrlOf(user);
    expect(newUrl).not.toBe(oldUrl);
    await expectAvatarImage(pageAvatar(page), newUrl);
    await expectAvatarImage(headerAvatar(page), newUrl);
  });

  test('the avatar persists after signing out and in', async ({ page }) => {
    const user = await signUp();
    await signInWithForm(page, user);
    await profileLink(page, user.email).click();
    await avatarInput(page).setInputFiles(fixturePath('avatar.webp'));
    await expect(removePhotoButton(page)).toBeVisible();
    const avatarUrl = await avatarUrlOf(user);

    await header(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
    await signInWithForm(page, user);

    await expectAvatarImage(headerAvatar(page), avatarUrl);
    await profileLink(page, user.email).click();
    await expectAvatarImage(pageAvatar(page), avatarUrl);
  });

  test('a wrong format names the reason and sends no request', async ({
    page,
  }) => {
    const user = await signUp();
    await openProfile(page, user);
    const sent = watchAvatarUploads(page);

    await avatarInput(page).setInputFiles(fixturePath('avatar.gif'));

    await expect(avatarError(page)).toContainText(AVATAR_UNSUPPORTED);
    expect(sent).toHaveLength(0);
    await expectInitials(pageAvatar(page), emailInitial(user));
    expect((await getProfile(user)).avatarUrl).toBeNull();
  });

  test('a wrong format keeps the previous avatar', async ({ page }) => {
    const user = await signUp();
    const { avatarUrl } = await uploadAvatar(user, 'avatar.png');
    await openProfile(page, user);
    const sent = watchAvatarUploads(page);

    await avatarInput(page).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(avatarError(page)).toContainText(AVATAR_UNSUPPORTED);
    expect(sent).toHaveLength(0);
    await expectAvatarImage(pageAvatar(page), avatarUrl!);
    await expectAvatarImage(headerAvatar(page), avatarUrl!);
  });

  test('a file over the size limit names the reason and sends no request', async ({
    page,
  }) => {
    const user = await signUp();
    await openProfile(page, user);
    const sent = watchAvatarUploads(page);
    const jpg = fixture('avatar.jpg');
    // Trailing bytes after the JPEG end marker: still a valid image.
    const padded = (size: number) =>
      Buffer.concat([jpg, Buffer.alloc(size - jpg.length)]);

    await avatarInput(page).setInputFiles({
      name: 'big.jpg',
      mimeType: 'image/jpeg',
      buffer: padded(AVATAR_MAX_BYTES + 1),
    });

    await expect(avatarError(page)).toContainText(AVATAR_TOO_LARGE);
    expect(sent).toHaveLength(0);
    await expectInitials(pageAvatar(page), emailInitial(user));

    // Exactly the limit is allowed.
    await avatarInput(page).setInputFiles({
      name: 'limit.jpg',
      mimeType: 'image/jpeg',
      buffer: padded(AVATAR_MAX_BYTES),
    });

    await expect(removePhotoButton(page)).toBeVisible();
    await expect(avatarError(page)).toHaveCount(0);
    expect(sent).toHaveLength(1);
    await expectAvatarImage(pageAvatar(page), await avatarUrlOf(user));
  });

  test.describe(() => {
    // One pattern: Playwright reads a two-item array as [value, options].
    test.use({ allowConsoleErrors: [/ERR_FAILED|status of (500|409)/] });

    // A 409 is a concurrent change of the avatar, so trying again can work.
    for (const failure of ['server', 'network', 'conflict'] as const) {
      test(`a ${failure} failure shows an error with Try again and keeps the previous avatar`, async ({
        page,
      }) => {
        const user = await signUp();
        const { avatarUrl: oldUrl } = await uploadAvatar(user, 'avatar.png');
        await openProfile(page, user);
        let failed = false;
        await page.route(AVATAR_ENDPOINT, (route) => {
          if (route.request().method() !== 'PUT' || failed)
            return route.continue();
          failed = true;
          if (failure === 'network') return route.abort('failed');
          const [status, message] =
            failure === 'server'
              ? [500, 'Internal server error']
              : [409, 'The avatar was changed by another request, try again'];
          return route.fulfill({
            status,
            headers: { 'Access-Control-Allow-Origin': WEB_URL },
            json: { statusCode: status, message },
          });
        });

        await avatarInput(page).setInputFiles(fixturePath('avatar.jpg'));

        await expect(avatarError(page)).toBeVisible();
        if (failure === 'network') {
          await expect(avatarError(page)).toContainText(AVATAR_UPLOAD_FAILED);
        }
        await expectAvatarImage(pageAvatar(page), oldUrl!);
        await expectAvatarImage(headerAvatar(page), oldUrl!);
        expect((await getProfile(user)).avatarUrl).toBe(oldUrl);

        await tryAgainButton(page).click();

        // The error goes as soon as the retry starts; wait for it to finish.
        await expect(page.getByText('Photo updated')).toBeVisible();
        await expect(avatarError(page)).toHaveCount(0);
        const newUrl = await avatarUrlOf(user);
        expect(newUrl).not.toBe(oldUrl);
        await expectAvatarImage(pageAvatar(page), newUrl);
        await expectAvatarImage(headerAvatar(page), newUrl);
      });
    }
  });
});

test.describe('avatar removal', () => {
  test('removing after confirmation shows initials in the profile and header', async ({
    page,
  }) => {
    const user = await signUp();
    await setName(user, 'Ann Lee');
    const { avatarUrl } = await uploadAvatar(user, 'avatar.png');
    await openProfile(page, user);
    await markWindow(page);
    await expectAvatarImage(pageAvatar(page), avatarUrl!);

    // Cancelling keeps it.
    await removePhotoButton(page).click();
    await removeDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(removeDialog(page)).toHaveCount(0);
    await expectAvatarImage(pageAvatar(page), avatarUrl!);
    expect((await getProfile(user)).avatarUrl).toBe(avatarUrl);

    await removePhotoButton(page).click();
    await removeDialog(page).getByRole('button', { name: 'Remove' }).click();

    await expect(removeDialog(page)).toHaveCount(0);
    await expectInitials(pageAvatar(page), 'AL');
    await expectInitials(headerAvatar(page), 'AL');
    await expect(removePhotoButton(page)).toHaveCount(0);
    await expect(uploadPhotoButton(page)).toBeVisible();
    expect((await getProfile(user)).avatarUrl).toBeNull();
    await expectSameWindow(page);
  });

  test.describe(() => {
    test.use({ allowConsoleErrors: [/ERR_FAILED/] });

    test('a failed removal stays in the dialog with Try again', async ({
      page,
    }) => {
      const user = await signUp();
      const { avatarUrl } = await uploadAvatar(user, 'avatar.png');
      await openProfile(page, user);
      let failed = false;
      await page.route(AVATAR_ENDPOINT, (route) => {
        if (route.request().method() !== 'DELETE' || failed)
          return route.continue();
        failed = true;
        return route.abort('failed');
      });

      await removePhotoButton(page).click();
      await removeDialog(page).getByRole('button', { name: 'Remove' }).click();

      await expect(removeDialog(page)).toBeVisible();
      await expect(
        removeDialog(page).getByRole('button', { name: 'Try again' }),
      ).toBeVisible();
      await expectAvatarImage(headerAvatar(page), avatarUrl!);
      expect((await getProfile(user)).avatarUrl).toBe(avatarUrl);

      await removeDialog(page)
        .getByRole('button', { name: 'Try again' })
        .click();

      await expect(removeDialog(page)).toHaveCount(0);
      await expectInitials(pageAvatar(page), emailInitial(user));
      await expectInitials(headerAvatar(page), emailInitial(user));
      expect((await getProfile(user)).avatarUrl).toBeNull();
    });
  });
});

test.describe('concurrent saves', () => {
  test('saving the name during an upload keeps the new avatar', async ({
    page,
  }) => {
    const user = await signUp();
    await openProfile(page, user);
    const upload = await holdAvatarUpload(page);
    await avatarInput(page).setInputFiles(fixturePath('avatar.png'));
    await expect.poll(upload.isHeld).toBe(true);

    // The name save answers first, with the profile that has no avatar yet.
    await nameInput(page).fill('Ann Lee');
    await saveButton(page).click();
    await expect(success(page)).toBeVisible();
    upload.release();

    await expect(changePhotoButton(page)).toBeEnabled();
    const avatarUrl = await avatarUrlOf(user);
    await expectAvatarImage(pageAvatar(page), avatarUrl);
    await expectAvatarImage(headerAvatar(page), avatarUrl);
    await expect(profileLink(page, 'Ann Lee')).toBeVisible();
  });

  test('removing the avatar during a name save keeps the new name', async ({
    page,
  }) => {
    const user = await signUp();
    await setName(user, 'Ann Lee');
    await uploadAvatar(user, 'avatar.png');
    await openProfile(page, user);
    const nameSave = await holdNameSave(page);
    await nameInput(page).fill('Bob Stone');
    await saveButton(page).click();
    await expect.poll(nameSave.isHeld).toBe(true);

    // The removal finishes first, while the old name is still shown.
    await removePhotoButton(page).click();
    await removeDialog(page).getByRole('button', { name: 'Remove' }).click();
    await expect(removeDialog(page)).toHaveCount(0);
    await expectInitials(headerAvatar(page), 'AL');
    nameSave.release();

    await expect(success(page)).toBeVisible();
    await expect(profileLink(page, 'Bob Stone')).toBeVisible();
    await expectInitials(headerAvatar(page), 'BS');
    await expectInitials(pageAvatar(page), 'BS');
  });
});

test.describe('initials', () => {
  for (const [name, initials] of [
    ['Ann Lee', 'AL'],
    ['ann lee', 'AL'],
    ['Cher', 'C'],
  ] as const) {
    test(`are "${initials}" for the name "${name}"`, async ({ page }) => {
      const user = await signUp();
      await setName(user, name);
      await signIn(page, user);

      await page.goto('/');

      await expect(headerAvatar(page)).toHaveText(initials);
      await expect(greeting(page)).toHaveText(name);
    });
  }

  test("are the email's first letter when there is no name", async ({
    page,
  }) => {
    const user = await signUp();
    await signIn(page, user);

    await page.goto('/');

    await expect(headerAvatar(page)).toHaveText(emailInitial(user));
    await expect(greeting(page)).toHaveText(user.email);
  });
});

test.describe('keyboard', () => {
  test('opens the profile, saves a name and sees the result with keyboard only', async ({
    page,
  }) => {
    const user = await signUp();
    await signIn(page, user);
    await page.goto('/');
    await expect(greeting(page)).toHaveText(user.email);

    await tabTo(page, profileLink(page, user.email));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/profile');

    await tabTo(page, nameInput(page));
    await page.keyboard.type('Ann Lee');
    await page.keyboard.press('Enter');

    await expect(success(page)).toBeVisible();
    await expect(profileLink(page, 'Ann Lee')).toBeVisible();

    await nameInput(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('a'.repeat(101));
    await tabTo(page, saveButton(page));
    await page.keyboard.press('Enter');

    await expect(page.getByText(NAME_TOO_LONG)).toBeVisible();
  });

  test('uploads and removes the avatar with keyboard only', async ({
    page,
  }) => {
    const user = await signUp();
    await openProfile(page, user);

    await tabTo(page, uploadPhotoButton(page));
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooser).setFiles(fixturePath('avatar.png'));

    await expect(removePhotoButton(page)).toBeVisible();
    await expectAvatarImage(headerAvatar(page), await avatarUrlOf(user));
    // The picker is disabled during the upload; focus comes back to it.
    await expect(changePhotoButton(page)).toBeFocused();

    await tabTo(page, removePhotoButton(page));
    await page.keyboard.press('Enter');
    await expect(removeDialog(page)).toBeVisible();
    await tabTo(
      page,
      removeDialog(page).getByRole('button', { name: 'Remove' }),
    );
    await page.keyboard.press('Enter');

    await expect(removeDialog(page)).toHaveCount(0);
    await expectInitials(headerAvatar(page), emailInitial(user));
    // Remove photo is gone, so focus moves to the picker, not the page.
    await expect(uploadPhotoButton(page)).toBeFocused();
  });
});

test.describe('layout', () => {
  const longName =
    'Maximiliana Alexandrina Konstantinopoulou-Vanderbilt Featherstonehaugh';

  for (const width of [375, 1440, 1920]) {
    test(`has no horizontal scroll at ${width} px`, async ({ page }) => {
      const user = await signUp();
      await setName(user, longName);
      await page.setViewportSize({ width, height: 900 });

      await openProfile(page, user);

      await expect(profileLink(page, longName)).toBeVisible();
      await expectNoHorizontalScroll(page);

      await nameInput(page).fill('a'.repeat(101));
      await saveButton(page).click();
      await expect(page.getByText(NAME_TOO_LONG)).toBeVisible();
      await expectNoHorizontalScroll(page);

      await nameInput(page).fill(longName);
      await saveButton(page).click();
      await expect(success(page)).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.goto('/');
      await expect(greeting(page)).toHaveText(longName);
      await expectNoHorizontalScroll(page);
    });

    test(`the avatar section has no horizontal scroll at ${width} px`, async ({
      page,
    }) => {
      const user = await signUp();
      await setName(user, longName);
      const { avatarUrl } = await uploadAvatar(user, 'avatar.png');
      await page.setViewportSize({ width, height: 900 });

      await openProfile(page, user);

      await expectAvatarImage(headerAvatar(page), avatarUrl!);
      await expectAvatarImage(pageAvatar(page), avatarUrl!);
      await expectNoHorizontalScroll(page);

      await avatarInput(page).setInputFiles(fixturePath('avatar.gif'));
      await expect(avatarError(page)).toContainText(AVATAR_UNSUPPORTED);
      await expectNoHorizontalScroll(page);

      await removePhotoButton(page).click();
      await expect(removeDialog(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});
