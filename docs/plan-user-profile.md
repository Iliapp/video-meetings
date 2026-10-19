# Plan: User profile

**PRD**: @docs/prd-user-profile.md
**Date:** 2026-10-18

## Implementation Phases

### Phase 1: Profile api: read and rename (tracer bullet, backend)

**Goal:** The signed-in user can read their own profile and set or clear their display name through the api. This is the minimal end-to-end path (database → api → response) that the following phases build on.
**Affects:** backend / database
**Tasks:**

- [ ] Write `apps/api/test/profile.e2e-spec.ts` and confirm it fails (red): `GET /users/me` without or with an invalid token → `401`; with a token → `{ id, email, name: null, avatarUrl: null }`; `PATCH /users/me` with `{ name: '  Ann  ' }` → saved as `Ann` and returned by a following `GET`; `{ name: null }` clears it; `{ name: '   ' }`, `{ name: '' }` or a name longer than 100 characters → `400` with a message and the stored name unchanged; a second user's `GET` doesn't see the first user's name.
- [ ] Add an optional `name` column to `User` in `prisma/schema.prisma` and create the migration.
- [ ] Add `GetProfileQuery` and `UpdateProfileCommand` to `src/users/` (CQRS, per `apps/api/CLAUDE.md`), with a DTO that trims the name and validates 1–100 characters or `null`.
- [ ] Add a `ProfileController` with `GET /users/me` and `PATCH /users/me` behind `JwtAuthGuard`, acting only on `@CurrentUser()` (no user id in the URL); unit specs for the handlers.
- [ ] Update `apps/api/CLAUDE.md` (users module now has a controller, new routes, `name` column).

**Done criteria:** `profile.e2e-spec.ts` is green; all earlier api unit and e2e tests still pass; `pnpm lint`, `pnpm typecheck` and `pnpm build` pass for the api.

### Phase 2: Profile page with name and header identity (frontend)

**Goal:** The signed-in user opens `/profile` from the header, sees their email and name, edits the name, and the header and dashboard greeting show it (or the email) without a reload.
**Affects:** frontend
**Tasks:**

- [ ] Write `apps/web/e2e/profile.spec.ts` and confirm it fails (red): signed-out `/profile` → `/login`; the header shows an initials circle and the email and links to `/profile`; the page shows the email read-only and the name field; saving a name shows "Profile updated" and the header and dashboard greeting show it without a reload; it persists after signing out and in; clearing it (empty or whitespace-only, sent as `null`) falls back to the email; a 101-character name shows a field error and sends no request; initials come from the name, or the email's first letter when there is no name; keyboard-only flow; no horizontal scroll at 375, 1440 and 1920 px.
- [ ] Add `getProfile` and `updateProfile` to `src/lib/api.ts` and a shared client-side profile state that the header, dashboard and profile page read and that updates after a save.
- [ ] Add a reusable avatar component (image or initials circle) and show it with the name or email in `AppHeader`, linking to `/profile`; switch the dashboard greeting to the name with the email fallback.
- [ ] Add `src/app/profile/` with the email and name form (HeroUI), client validation matching the api, success and server-error states, and the signed-in guard.
- [ ] Test in the running app with the Playwright MCP and review with `ui-ux-pro-max` (per `apps/web/CLAUDE.md` definition of done); update `apps/web/CLAUDE.md` (profile route, avatar component, profile state).

**Done criteria:** `profile.spec.ts` is green; `meeting-recordings.spec.ts` and all api tests still pass; screenshots at 375, 1440 and 1920 px taken and reviewed; `pnpm lint` and `pnpm typecheck` pass.

### Phase 3: Avatar api: upload, serve, remove (backend)

**Goal:** The user uploads a JPG, PNG or WebP avatar up to 5 MB, the api serves it, and the user can replace or remove it; the profile returns its URL.
**Affects:** backend / database
**Tasks:**

- [ ] Write `apps/api/test/avatar.e2e-spec.ts` (with small image fixtures) and confirm it fails (red): `PUT /users/me/avatar` with a JPG, PNG and WebP → `GET /users/me` returns an `avatarUrl` that serves the image with its MIME type; a second upload replaces it and the old URL → `404`; an unsupported extension → `415`; an image extension with non-image content → `415`; a file above the limit → `413` with "File is larger than …"; a failed upload keeps the previous avatar; `DELETE /users/me/avatar` → `204`, `avatarUrl: null` and the old URL → `404`; no token → `401`; one user can't change another's avatar.
- [ ] Add the avatar storage key to `User` (migration) and an avatar storage service with an `AVATARS_DIR` (default `avatars/`, added to `apps/api/.gitignore`) and `AVATAR_MAX_BYTES` config (default 5 MB), following the recordings storage pattern; in `test/setup-env.ts` give each test file a temp `AVATARS_DIR` and a lowered `AVATAR_MAX_BYTES`, as for recordings.
- [ ] Add `UploadAvatarCommand` (multer to a temp file, magic-byte check with `file-type`, commit, then update the row only if the previous key is unchanged and delete whichever file lost) and `DeleteAvatarCommand`, with `PUT` and `DELETE /users/me/avatar` behind `JwtAuthGuard`; unit specs.
- [ ] Serve avatars at an unguessable URL that changes with every upload (so `<img src>` works without a `Bearer` header), with `X-Content-Type-Options: nosniff` and a cache policy as for recordings, and include it as `avatarUrl` in the profile response.
- [ ] Update `apps/api/CLAUDE.md` (avatar routes, storage, new env vars) and `.env.example`.

**Done criteria:** `avatar.e2e-spec.ts` is green; phase 1 and all earlier api tests still pass; `pnpm lint`, `pnpm typecheck` and `pnpm build` pass for the api.

### Phase 4: Avatar upload and removal in the web (frontend)

**Goal:** On the profile page the user uploads, replaces and removes their avatar, and the header shows it on every signed-in page.
**Affects:** frontend
**Tasks:**

- [ ] Extend `apps/web/e2e/profile.spec.ts` with avatar tests and confirm they fail (red): uploading a JPG, PNG or WebP ≤ 5 MB shows a preview, then the avatar in the profile and header; it persists after signing out and in; a wrong extension or a file above 5 MB shows the reason and sends no request; a server or network failure shows an error with Try again and keeps the previous avatar; removing after confirmation shows initials in the profile and header.
- [ ] Add `uploadAvatar` and `deleteAvatar` to `src/lib/api.ts` and the avatar allow-list and size limit (`NEXT_PUBLIC_AVATAR_MAX_BYTES`, kept equal to the api's, validated in `next.config.ts` and added to `apps/web/.env.example`) to `src/lib/`.
- [ ] Add the avatar section to the profile page: file picker (react-aria `FileTrigger` + HeroUI `Button`), preview, upload state, error with retry, and a HeroUI `AlertDialog` to confirm removal; update the shared profile state so the header changes without a reload.
- [ ] Set the e2e servers' avatar limit and an `AVATARS_DIR` under `.e2e/` in `playwright.config.ts`, and add image fixtures.
- [ ] Test in the running app with the Playwright MCP and review with `ui-ux-pro-max`; update `apps/web/CLAUDE.md` (avatar section, env var).

**Done criteria:** the avatar tests in `profile.spec.ts` are green; phase 2 tests, `meeting-recordings.spec.ts` and all api tests still pass; screenshots at 375, 1440 and 1920 px taken and reviewed; `pnpm lint` and `pnpm typecheck` pass.

### Phase 5: Password change api (backend)

**Goal:** The user changes their password by giving the current one; the existing token keeps working.
**Affects:** backend
**Tasks:**

- [ ] Write `apps/api/test/change-password.e2e-spec.ts` and confirm it fails (red): `POST /auth/change-password` with the correct current password and a new password of 8+ characters → `204`; afterwards login with the old password → `401` and with the new one → `200`; the token used for the change still works on `GET /users/me`; a wrong current password → `400` "Current password is incorrect" (not `401`, which the web treats as an expired session) and the old password still works; a new password under 8 characters → `400`; no token → `401`.
- [ ] Add `ChangePasswordCommand` to `src/auth/` that reads the stored hash with `FindUserByEmailQuery` (email from the token), verifies the current password with `PasswordService`, hashes the new one, and stores it through a new users command (modules talk through the buses); unit specs.
- [ ] Add the route behind `JwtAuthGuard` with a DTO (current password required, new password min 8, as in `RegisterDto`).
- [ ] Update `apps/api/CLAUDE.md` (auth route and command).

**Done criteria:** `change-password.e2e-spec.ts` is green; phases 1 and 3 and all earlier api tests still pass; `pnpm lint`, `pnpm typecheck` and `pnpm build` pass for the api.

### Phase 6: Password change form (frontend)

**Goal:** On the profile page the user changes their password and stays signed in.
**Affects:** frontend
**Tasks:**

- [ ] Extend `apps/web/e2e/profile.spec.ts` with password tests and confirm they fail (red): correct current password + valid matching new password → "Password changed", the user stays on the page signed in, and signing in again works only with the new password; a wrong current password → "Current password is incorrect" as a field error and the user stays signed in; a new password under 8 characters or a non-matching confirmation → field error and no request; keyboard-only flow.
- [ ] Add `changePassword` to `src/lib/api.ts`.
- [ ] Add the password form to the profile page (current, new, confirmation with `PasswordField`), client validation, success and server-error states; the form clears after success.
- [ ] Test in the running app with the Playwright MCP and review with `ui-ux-pro-max`; update `apps/web/CLAUDE.md`.

**Done criteria:** the password tests in `profile.spec.ts` are green; all earlier web and api tests still pass; screenshots at 375, 1440 and 1920 px taken and reviewed; `pnpm lint` and `pnpm typecheck` pass.

## PRD coverage

| Criterion of readiness                             | Phases  |
| -------------------------------------------------- | ------- |
| Open `/profile` from header; signed-out → `/login` | 2       |
| Profile shows email, name, avatar or initials      | 1, 2, 4 |
| Save name, live header/greeting update, persists   | 1, 2    |
| Clearing name falls back to email                  | 1, 2    |
| Invalid name rejected by web and api               | 1, 2    |
| Avatar upload replaces it, persists                | 3, 4    |
| Wrong format / fake image rejected                 | 3, 4    |
| File above 5 MB rejected by web and api            | 3, 4    |
| Failed upload: error, retry, previous avatar stays | 3, 4    |
| Remove avatar → initials, old image not served     | 3, 4    |
| Initials from name or email                        | 2       |
| Password change works, stays signed in             | 5, 6    |
| Wrong current password message                     | 5, 6    |
| Short / mismatched new password rejected           | 5, 6    |
| Only own profile, avatar and password              | 1, 3, 5 |
| 375/1440/1920 px, no horizontal scroll, keyboard   | 2, 4, 6 |
| api e2e and web Playwright e2e cover the scenarios | all     |
