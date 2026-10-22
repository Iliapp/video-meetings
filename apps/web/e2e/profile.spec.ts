import type { Locator, Page, Request } from '@playwright/test';
import { API_URL } from './env';
import {
  expect,
  expectNoHorizontalScroll,
  setName,
  signIn,
  signInWithForm,
  signUp,
  test,
  type TestUser,
} from './fixtures';

const NAME_TOO_LONG = 'Name must be 100 characters or fewer';

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
  }
});
