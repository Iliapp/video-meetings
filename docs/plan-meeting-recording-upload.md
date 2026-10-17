# Plan: Meeting recording upload

**PRD**: [docs/prd-meeting-recording-upload.md](prd-meeting-recording-upload.md)
**Date:** 2026-10-15

## Technical decisions

- **Storage:** original files go on local disk in a directory set by a new api env var `RECORDINGS_DIR`. Each file is stored under a server-generated UUID key, never under the original name. A storage service hides the file layout from the rest of the code. Metadata goes in Postgres (Prisma `Recording` model).
- **Size limit:** set by `RECORDINGS_MAX_BYTES` on the api and `NEXT_PUBLIC_RECORDINGS_MAX_BYTES` on the web, both defaulting to 2 GB. e2e tests lower both, so size rejection can be tested without a 2 GB file.
- **Format:** the api maps the file extension, checked against the file's magic bytes, to a fixed MIME type and kind (video/audio). It never stores the client's `Content-Type`.
- **Duration:** the web app reads it from the file's media metadata before upload. It may be unknown: WebM from `MediaRecorder` often reports `Infinity`. In that case the web app sends no duration. The api accepts an optional finite non-negative number, stores `null` when it is omitted, and answers `400` for any other value. The list shows "—" for an unknown duration.
- **Long uploads:** the api raises the Node HTTP server's `requestTimeout` (300 s by default) in `main.ts`, so a 2 GB upload over a slow connection isn't cut off.
- **Playback and download auth:** an authenticated endpoint returns signed URLs. Their TTL is set by `RECORDING_URL_TTL`, with a default long enough to cover a viewing session. The stream and download endpoints check the signed token rather than a `Bearer` header, so `<video>`, `<audio>` and download links work. Streaming supports HTTP Range requests. Both endpoints respond with `X-Content-Type-Options: nosniff`, and the download encodes non-ASCII file names with `filename*`. If a URL expires mid-playback, the player fetches new URLs and resumes from where it was.
- **Access:** a new CQRS feature module, `src/recordings/`, checks access to a meeting through `GetMeetingQuery` on the bus. A user who is neither the owner nor invited gets `404`. An invited participant who calls upload or delete gets `403`.
- **Test-first:** each phase starts by writing e2e tests for its done criteria and running them to confirm they fail (red). The phase is finished only when the same tests pass (green) and no earlier phase's tests have started failing.
  - **api:** `apps/api/test/*.e2e-spec.ts` (supertest, `pnpm --filter api test:e2e`).
    - `test/setup-env.ts` points `RECORDINGS_DIR` at a temp directory.
    - Small MP4, WebM (including one without duration), MP3, M4A and WAV fixtures live in `apps/api/test/fixtures/`.
  - **web:** Playwright Test in `apps/web/e2e/` (`pnpm --filter web test:e2e`).
    - Its `webServer` config starts the api against `video_meetings_test` with a temp `RECORDINGS_DIR` and a lowered size limit, and starts the web app pointed at that api.
    - Tests create their own users and meetings through the api and reuse the api fixtures.
    - `pnpm db:up` and `pnpm --filter web exec playwright install` are the only manual setup.

## Implementation Phases

### Phase 1: API: upload and list recordings (tracer bullet)

**Goal:** The owner can upload a recording to a meeting over the api, and the owner and invited participants can list it. Files and metadata persist across api restarts.
**Affects:** backend / database
**Tasks:**

- [x] Write the e2e tests first (`test/recordings.e2e-spec.ts`), plus the fixtures and the temp `RECORDINGS_DIR` in `test/setup-env.ts`. Run them and confirm they fail.
  - Upload each supported format, including a WebM without duration, which is stored as `null`.
  - Rejections for format (`415`), including a file renamed to a supported extension, and for size (`413`). The message names the reason, and no row or file is left behind.
  - An upload aborted mid-request leaves no row or file.
  - A list of at least 10 recordings, newest first, with full metadata.
  - Owner, invited and outsider access to upload and list.
  - Data still present after the app is closed and started again.
- [x] Add a Prisma `Recording` model and migration: meeting, uploader, original file name, MIME type, kind (video/audio), size, nullable duration, storage key (UUID), created at. Add `RECORDINGS_DIR`, `RECORDINGS_MAX_BYTES` and a local-disk storage service.
- [x] Generate the `recordings` CQRS module. Add `@types/multer`.
  - `POST /meetings/:id/recordings` takes a multipart file plus an optional duration and streams it to disk.
  - It accepts only MP4, WebM, MP3, M4A and WAV within the size limit, and derives the MIME type and kind from the extension plus magic bytes.
  - Only the owner can upload: invited participants get `403`, everyone else `404`.
  - On any rejection, failure or aborted request, it deletes the partial file and creates no row.
  - Raise the server's `requestTimeout` in `main.ts`.
- [x] `GET /meetings/:id/recordings` lists recordings newest first, with name, kind, size, duration, upload date and uploader email. The owner and invited participants can list. Everyone else gets `404`.
- [x] Add unit tests for the handlers and the storage service. Update `apps/api/CLAUDE.md` (Structure, env, timeout) and `.env.example`. Run the Phase 1 e2e tests and confirm they now pass.

**Done criteria:** All Phase 1 e2e tests that were red at the start now pass, along with the existing api e2e suite. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.

### Phase 2: Web: meeting page, recordings list and upload

**Goal:** From the dashboard, a user opens a meeting page that shows details and recordings. The owner uploads files there with progress, cancel and retry.
**Affects:** frontend
**Tasks:**

- [ ] Set up Playwright Test in `apps/web`: config with `webServer` (test database, temp `RECORDINGS_DIR`, lowered size limits) and a `test:e2e` script. Write the e2e tests first, then run them and confirm they fail.
  - Open the meeting from the dashboard and see its title, date, participants and Recordings section.
  - Empty state, with an upload action for the owner only.
  - Upload by file picker and by drag-and-drop.
  - Progress, then the recording appears in the list without a reload.
  - A WebM without duration shows "—".
  - Cancel adds nothing to the list.
  - The format and size errors name the reason.
  - Upload failure (api request intercepted) shows an error, retry works, and no entry is added.
  - The invited user sees the list but no upload controls.
  - The outsider sees "not found".
  - No horizontal scroll at 375, 1440 and 1920 px.
  - No console errors.
- [ ] Add a `/meetings/[id]` page that shows title, date, participants and a "Recordings" section, with a "not found" state for `404`. Dashboard meetings link to it. Add typed functions in `src/lib/api.ts`.
- [ ] Recordings list: newest first, with name, type, size, duration ("—" when unknown), upload date and uploader. Show an empty state when there are none, with an upload action for the owner only.
- [ ] Upload control, owner only.
  - File picker plus drag-and-drop.
  - Check format and size (`NEXT_PUBLIC_RECORDINGS_MAX_BYTES`) before starting.
  - Read the duration from the file's media metadata, and leave it unset when it isn't finite.
  - Upload with progress (XHR), cancel and retry, then add the result to the list without a reload.
- [ ] Update `apps/web/CLAUDE.md` (Structure, env, the `test:e2e` command and its setup) and the root `CLAUDE.md` (web now has e2e tests), plus `.env.example`. Run the `ui-ux-pro-max` review and take Playwright MCP screenshots at 375, 1440 and 1920 px. Run the Phase 2 e2e tests and confirm they now pass.

**Done criteria:** All Phase 2 web e2e tests that were red at the start now pass. The Phase 1 api e2e tests still pass. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

### Phase 3: API: playback, download and delete

**Goal:** Recordings can be streamed and downloaded through signed URLs, and the owner can delete them.
**Affects:** backend
**Tasks:**

- [ ] Write the e2e tests first, then run them and confirm they fail.
  - Signed URLs are issued to the owner and invited participants, and the request gets `404` for outsiders and unknown recordings.
  - The stream has the canonical MIME type and `nosniff`, and a Range request returns `206`.
  - The download is byte-identical to the upload and carries the original file name, including a non-ASCII one.
  - Missing, expired or invalid tokens get `404`, including on a Range request.
  - The owner can delete. Invited participants get `403` and outsiders `404`.
  - After a delete, the row and the file are gone, and links issued before it return `404`.
- [ ] `GET /meetings/:id/recordings/:recordingId/urls` (Bearer, owner and invited) returns signed stream and download URLs that expire after `RECORDING_URL_TTL`. Everyone else, and unknown recordings, get `404`.
- [ ] Stream endpoint: checks the signed token, serves the file with its stored MIME type, `nosniff` and HTTP Range support. Download endpoint: serves the original bytes with `Content-Disposition: attachment` and the original file name (`filename*`). A missing, expired or invalid token, or a deleted recording, gets `404`.
- [ ] `DELETE /meetings/:id/recordings/:recordingId` (owner only) deletes the row first, then the file. If deleting the file fails, log it, and the recording is still gone for users.
- [ ] Add unit tests for the new handlers and token signing. Update `apps/api/CLAUDE.md` with the new routes and `RECORDING_URL_TTL`, and `.env.example`. Run the Phase 3 e2e tests and confirm they now pass.

**Done criteria:** All Phase 3 e2e tests that were red at the start now pass, along with the Phase 1 e2e tests. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.

### Phase 4: Web: play, download and delete recordings

**Goal:** On the meeting page, the owner and invited participants play and download recordings, and the owner deletes them after confirming.
**Affects:** frontend
**Tasks:**

- [ ] Write the Playwright e2e tests first, then run them and confirm they fail.
  - The owner and the invited user each play an MP4 and an MP3 in the page.
  - Playback continues after its URL expires (short TTL in the e2e environment).
  - A downloaded file is byte-identical to the fixture.
  - Delete confirmed removes the recording for both users. Delete cancelled keeps it.
  - The old links return "not found".
  - The invited user sees no delete control.
  - A recording that has already been deleted shows a clear message.
  - No horizontal scroll at 375, 1440 and 1920 px.
  - No console errors.
- [ ] Play action: open an in-page video or audio player for the recording, using the signed stream URL. On a media error, fetch new URLs and resume from `currentTime`. "Download" action: fetch the signed download URL and download the original file.
- [ ] Delete action (owner only): a confirmation dialog, then remove the recording from the list. Show an error if the delete fails.
- [ ] Handle a recording that is gone (`404` on urls, stream or download) with a clear message, and refresh the list.
- [ ] Update `apps/web/CLAUDE.md`. Run the `ui-ux-pro-max` review and take Playwright MCP screenshots at 375, 1440 and 1920 px. Run the Phase 4 e2e tests and confirm they now pass.

**Done criteria:** All Phase 4 web e2e tests that were red at the start now pass. The Phase 2 web and Phases 1 and 3 api e2e suites still pass. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## PRD readiness coverage

| Readiness criterion                                         | Phase | Covered by e2e |
| ----------------------------------------------------------- | ----- | -------------- |
| Meeting page from the dashboard with details and Recordings | 2     | web            |
| Upload supported formats up to 2 GB, list without reload    | 1, 2  | api, web       |
| Progress and cancel                                         | 2     | web            |
| Reject format and size with reason, nothing stored          | 1, 2  | api, web       |
| Failed upload: error, retry, no partial entry               | 1, 2  | api, web       |
| At least 10 recordings, newest first, full metadata         | 1, 2  | api, web       |
| Empty state with upload action for the owner                | 2     | web            |
| Play video and audio in the page                            | 3, 4  | api, web       |
| Byte-identical download                                     | 3, 4  | api, web       |
| Delete with confirmation, links return "not found"          | 3, 4  | api, web       |
| Invited: no upload or delete controls, api rejects          | 1–4   | api, web       |
| Outsiders get "not found" everywhere                        | 1–4   | api, web       |
| Persists after api restart                                  | 1     | api            |
| No horizontal scroll at 375, 1440, 1920, no console errors  | 2, 4  | web            |
| Unit and e2e tests, lint, typecheck and test pass           | 1–4   | api, web       |
