@AGENTS.md

# web (Next.js)

Next.js 16 (App Router) + React 19 frontend for video meetings. Dev server on `:3000`.

## Commands (run in `apps/web`, or `pnpm --filter web <script>` from root)

- `pnpm dev`: `next dev`
- `pnpm build`: production build
- `pnpm start`: serve the production build
- `pnpm lint`: ESLint (`eslint-config-next` core-web-vitals + typescript, plus prettier)
- `pnpm typecheck`: `tsc --noEmit`
- `pnpm test:e2e`: Playwright Test (`playwright.config.ts`, specs in `e2e/`); see E2E tests

## Environment

Copy `.env.example` to `.env.local`:

- `NEXT_PUBLIC_API_URL`: base URL of `apps/api` (default `http://localhost:4000`).
- `NEXT_PUBLIC_RECORDINGS_MAX_BYTES`: upload size pre-check, default `2147483648` (2 GB). Keep it equal to the api's `RECORDINGS_MAX_BYTES`; `next.config.ts` fails the build when it isn't a positive integer.
- `NEXT_PUBLIC_AVATAR_MAX_BYTES`: avatar size pre-check, default `5242880` (5 MB). Keep it equal to the api's `AVATAR_MAX_BYTES`; validated like the recordings limit.
- `NEXT_DIST_DIR`: build directory, default `.next`. Only the e2e web server sets it (`.next-e2e`).

## Structure

- `src/app/`: App Router routes (`layout.tsx`, `globals.css`).
  - `page.tsx` + `dashboard.tsx`: home, signed-in only. Greets the user by name (`useProfile`, the email when there is none or the profile fails to load), shows meeting counts and the next/most recent meetings (`GET /meetings`), creates meetings in `create-meeting-modal.tsx` (`POST /meetings`), and signs out. No token, an expired token or a `401` → clears the token and redirects to `/login`.
  - `login/`: sign-in page (`page.tsx` + `login-form.tsx`) → `POST /auth/login`; `401` shows "Incorrect email or password". Redirects to `/` on success or if already signed in.
  - `register/`: sign-up page (`page.tsx` + `register-form.tsx`) → `POST /auth/register`; redirects to `/` on success.
  - `profile/`: profile page, signed-in only, opened from the header. `profile-page.tsx` loads `useProfile` (skeleton, load error with Try again) and shows the avatar, name and password parts in one card. `avatar-section.tsx`: the avatar with the name and email, Upload/Change photo (react-aria `FileTrigger`; `validateAvatarFile` first, no request when it fails), a preview of the picked file while it uploads, "Couldn't upload photo" with the reason (Try again for network and server errors and a `409` from a concurrent change; the previous avatar stays), and Remove photo behind a HeroUI `AlertDialog` (a failure stays in the dialog with Try again; after a removal or upload focus moves to the picker, since the trigger is gone or was disabled); `saveAvatar`/`removeAvatar` update the header without a reload, a `401` signs out. `name-form.tsx`: the read-only email and the name field. The name is validated like the api (at most 100 characters after trimming, no request when invalid), a blank name is sent as `null` (falls back to the email), and `saveName` updates the header and greeting without a reload; shows "Profile updated" or the api error, a `401` signs out. `password-form.tsx`: current, new and confirmed password (`PasswordField`), checked on submit (new password as at registration, the confirmation must match; no request when invalid), then errors update as the user types (`validationBehavior="aria"`, because react-aria's default clears them only on blur and the layout shift makes the button click miss). `changePassword` → "Password changed" and the form clears, the user stays signed in; the api's "Current password is incorrect" shows on the current password field (`Form` `validationErrors`, cleared on edit for the same reason), other errors in an alert, a `401` signs out.
  - `meetings/[id]/`: meeting page, signed-in only; dashboard meeting titles link here. `meeting-page.tsx` loads `GET /meetings/:id` (`404` → "Meeting not found") and shows title, date, host/invited and upcoming/past chips and participants (the api lists invitees only, so the host's email shows only to the host). `recordings-section.tsx` lists `GET /meetings/:id/recordings` newest first with an empty state, and owns the row actions: Play and Download fetch `GET …/recordings/:recordingId/urls` on press; a `404` there or on delete shows "This recording is no longer available", drops the row and reloads the list. `recording-row.tsx`: name, video/audio, size, duration or "—", upload date, uploader, and 44 px icon actions (Play/Close player, Download, Delete for the owner) with labels and tooltips. `recording-player.tsx`: one inline `<video>`/`<audio>` at a time on the signed stream URL; on a media error (expired URL) it fetches new URLs once per failure and resumes from the last position. Download checks the signed download URL with `HEAD` (a `404` counts as gone), then clicks a link to it (`Content-Disposition: attachment`). A confirmed delete shows a "Recording deleted" notice. `delete-recording-dialog.tsx` (owner only): HeroUI `AlertDialog` → `DELETE …/recordings/:recordingId`; a failure stays in the dialog with Try again. `recording-upload.tsx` (owner only): `useRecordingUpload` checks the extension and size, reads the duration from the file's metadata (left out when not finite), uploads with XHR progress, cancel (after a HeroUI `AlertDialog` confirmation; the upload continues while it is open) and retry, and adds the result to the list; `UploadButton` (react-aria `FileTrigger`) and `RecordingDropZone` (react-aria `DropZone`, hidden on small screens except in the empty state).
- `src/components/`: shared UI: `AppHeader` (for signed-in pages, takes the `session`: logo links home, the user's avatar and name or email link to `/profile` (avatar only below `sm`), sign out; a profile `401` signs out), `UserAvatar` (HeroUI `Avatar`: the image, else `initials()` of the name or the email's first letter; decorative, `data-testid="avatar"`), `AuthLayout` (brand panel + form column for `/login` and `/register`), `Logo`, `EmailField`, `PasswordField` (show/hide toggle; `label` and `name` default to "Password"/`password`), `TextLink`.
- `src/lib/passwords.ts`: the new-password rule shared by sign-up and password change (`MIN_PASSWORD_LENGTH` 8, as in the api; `validateNewPassword`).
- `src/lib/api.ts`: `fetch` wrapper for the api (`ApiError` with status + Nest error message, `Bearer` token option) and typed endpoint functions (incl. `getRecordingUrls`, `deleteRecording`, `getProfile`/`updateProfile` for `GET`/`PATCH /users/me`, `uploadAvatar`/`deleteAvatar` for `PUT`/`DELETE /users/me/avatar`, `changePassword` for `POST /auth/change-password`, a network failure as `ApiError` status 0); `uploadRecording` uses `XMLHttpRequest`, because `fetch` can't report upload progress.
- `src/lib/recordings.ts`: the upload allow-list and size limit (same messages as the api), `readMediaDuration`, `formatBytes`, `formatDuration`.
- `src/lib/avatars.ts`: the avatar allow-list (JPG, PNG, WebP) and size limit with the api's messages, `validateAvatarFile`.
- `src/lib/use-session.ts`: `useSession()` for signed-in client pages (`undefined` until hydrated, `null` → call `signOut`, which goes to `/login`).
- `src/lib/use-profile.ts`: `useProfile(token)`, the signed-in user's profile in one module-level store per tab (loaded once per token, `loading`/`ready`/`error`), so every reader shows a `saveName`, `saveAvatar` or `removeAvatar` result without a reload. Each save updates only its own field (`name` or `avatarUrl`), so concurrent name and avatar saves don't undo each other; a stale load never overwrites a newer save.
- `src/lib/auth-token.ts`: the access token in `localStorage` (`accessToken` key) and `readSession`/`getSession`, which decode its `sub`/`email`/`exp` claims client-side (unverified, for display and expiry only). Auth is client-side: pages guard themselves, there is no `proxy.ts`, because the server can't see `localStorage`.
- Import alias `@/*` maps to `src/*`.
- `AGENTS.md` (imported above) is regenerated by `next dev`; don't edit or delete it. Check `node_modules/next/dist/docs/` before using Next APIs, because this version differs from older training data.

## UI and styling

- Tailwind CSS v4 through `@tailwindcss/postcss`. Configure it in CSS (`@import 'tailwindcss'`, `@theme` in `globals.css`); there is no `tailwind.config.js`.
- Component library: **HeroUI v3** (`@heroui/react`, Tailwind v4 + React Aria). Use the `heroui-react` skill for component APIs, installation and theming instead of relying on memory. Prefer HeroUI components over hand-rolled ones.
- Design decisions (layout, color, typography, UX and accessibility review): use the `ui-ux-pro-max` skill. Implement its recommendations with HeroUI + Tailwind.
- Theme: HeroUI tokens, with the light-theme `--accent` (#2563eb) and `--danger` (#dc2626) overridden in `globals.css` for AA contrast on white. Use semantic tokens (`bg-accent`, `text-muted`, `variant="primary"`), not raw colors or gradients.
- Icons: `@gravity-ui/icons` (the set HeroUI docs use).
- File picker and drag-and-drop: `FileTrigger` / `DropZone` from `react-aria-components` (HeroUI doesn't re-export them; keep its version in line with the one HeroUI uses). Wrap a HeroUI `Button` in `FileTrigger`.
- Fonts: Geist / Geist Mono via `next/font/google`, exposed as `--font-geist-sans` / `--font-geist-mono`.

## Definition of done for UI changes

A task that changes anything visible (pages, components, styles, layout, copy, theme) is not done until both checks pass:

1. **Test it in the running app** with the Playwright MCP (`playwright` in `.mcp.json`) against `http://localhost:3000`: screenshot the changed screens at desktop (1440 and 1920) and mobile (375) widths, exercise the interactive states (validation errors, loading, success, server errors), and confirm there is no horizontal scroll and no console errors.
2. **Review it with the `ui-ux-pro-max` skill**: run its searches for the affected concerns and go through its priority checklist (accessibility and contrast, touch targets, layout and responsiveness, typography, spacing, forms and feedback). Fix what fails, then re-test.

`pnpm lint` and a type check passing is not enough. When reporting the task, say what was tested and at which widths.

## E2E tests

`pnpm test:e2e` (from `apps/web`, or `pnpm --filter web test:e2e`). Setup: `pnpm db:up` from the root, and Google Chrome installed (`pnpm exec playwright install chrome` where supported); the config uses `channel: 'chrome'` because Playwright's bundled Chromium doesn't support every OS (e.g. macOS 12).

- `playwright.config.ts` starts both servers on their own ports, so it runs next to `pnpm dev`: the api on `:4100` against `video_meetings_test` (migrations applied first) with `RECORDINGS_DIR=.e2e/recordings`, a 64 KB limit and `RECORDING_URL_TTL=4s` (to test playback after URL expiry), `AVATARS_DIR=.e2e/avatars` and a 16 KB avatar limit, and the web as `next build && next start` on `:3100` with `NEXT_DIST_DIR=.next-e2e` and the same limits. Locally, already-running servers on those ports are reused, so stop them after changing code.
- `e2e/meeting-recordings.spec.ts` covers the meeting page and recordings (list, upload, play, download, delete, layout). `e2e/profile.spec.ts` covers the profile page, name, header identity and avatar (upload, preview, replace, errors with Try again, remove, keyboard, layout) and password change (success, wrong current password then a fixed retry, client validation, keyboard, layout). `e2e/env.ts` holds the ports, limits, URL TTL and paths; `e2e/fixtures.ts` creates users, meetings, recordings, names and avatars through the api, checks credentials with `canSignIn`, signs the browser in via `localStorage` or the login form, and fails a test on any console error unless it lists the expected ones in `allowConsoleErrors`. Media and avatar image fixtures (`avatar.jpg|png|webp`, and `avatar.gif` as the unsupported format) are shared with the api (`apps/api/test/fixtures/`). Browser dates are checked in UTC, `en-US`.
- Run one file or test with `pnpm test:e2e <file>` or `-g "<title>"`. Traces of failed tests are kept in `test-results/`.

## Conventions

- Default to Server Components; add `'use client'` only where you need state, effects, or browser APIs (camera, mic, WebRTC).
- Call the backend (`apps/api`, `http://localhost:4000` in dev) through env-configured URLs, not hardcoded hosts.
