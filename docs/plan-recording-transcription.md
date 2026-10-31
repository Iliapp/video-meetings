    # Plan: Recording transcription

**PRD**: [docs/prd-recording-transcription.md](prd-recording-transcription.md)
**Date:** 2026-10-31

## Technical decisions

- **Engine:** [whisper.cpp](https://github.com/ggml-org/whisper.cpp) `whisper-cli`, run as a child process on the api server, with the low-cost `ggml-base` model. Language is auto-detected (`-l auto`). `ffmpeg` first extracts the audio track to a temp 16 kHz mono WAV, which `whisper-cli` needs for every format, including video. Both are system binaries, not npm packages: `brew install ffmpeg whisper-cpp` locally, the same packages on the server. A `whisper:model` script downloads the model once. After that, nothing goes over the network, so recordings never leave the server.
- **Config:** new api env vars `FFMPEG_PATH` (default `ffmpeg`), `WHISPER_CLI_PATH` (default `whisper-cli`), `WHISPER_MODEL_PATH` (default `models/ggml-base.bin`). Child processes get arguments as an array, never through a shell. The api still starts when a binary is missing, but every transcription fails with the server-error reason.
- **Data:** a new Prisma model `Transcription`, one per recording. It has a unique `recordingId` with `onDelete: Cascade`, a `status` enum `TranscriptionStatus { QUEUED TRANSCRIBING DONE FAILED }`, nullable `text` and `language`, a nullable `failureReason` enum `TranscriptionFailure { UNREADABLE_FILE NO_SPEECH SERVER_ERROR }`, plus `createdAt`/`updatedAt` and `@@index` on the foreign key, following `.claude/rules/prisma.md`. Recordings uploaded before this feature have no row, so they show no status. Deleting a recording cascades to its transcript.
- **Queue:** the database is the queue, so there is no Redis or extra process. A new CQRS module `src/transcriptions/` reacts to a `RecordingUploadedEvent` published after the upload commits. Its worker takes the oldest `QUEUED` row with a compare-and-set to `TRANSCRIBING` and runs one transcription at a time. The upload response doesn't wait for it. On startup, the worker resets `TRANSCRIBING` rows to `QUEUED` and drains the queue. It saves the result with a compare-and-set on `TRANSCRIBING`, so a recording deleted mid-run (its row is gone) or a superseded run saves nothing. Temp WAV files go under `RECORDINGS_DIR/incoming` and are deleted on success or failure.
- **API:** the `GET /meetings/:id/recordings` list gets `transcription: { status, failureReason } | null` (included through the Prisma relation, no N+1). `GET /meetings/:id/recordings/:recordingId/transcript` returns `{ text, language }` to the owner and invited participants. Unknown or not visible → `404`, not `DONE` → `409`. `POST /meetings/:id/recordings/:recordingId/transcription/retry` is owner only (`MeetingOwnerGuard`): participant → `403`, outsider → `404`, not `FAILED` → `409`. Both new endpoints sit under the existing recording access rules.
- **Live status:** the web app polls the recordings list every few seconds while any recording is `QUEUED` or `TRANSCRIBING`, and stops when none are. The project has no realtime layer, and adding one is out of scope.
- **Test-first:** each phase starts by writing e2e tests for its done criteria and running them to confirm they fail (red). The phase is finished only when the same tests pass (green) and no earlier phase's tests have started failing.
  - **Fixtures:** `apps/api/test/fixtures/speech.mp3` and `speech.mp4`, a few seconds of clear English speech with known words (generated with `say` + `ffmpeg`, committed). Also `silence.wav` and `corrupt.mp4` (valid magic bytes, unreadable stream).
  - **Real vs stub:** content tests run the real `ffmpeg` + `whisper-cli` + model, so `brew install ffmpeg whisper-cpp` and `pnpm --filter api whisper:model` become manual setup next to `pnpm db:up`. Timing tests (status while transcribing, restart, delete mid-run) restart the app with `WHISPER_CLI_PATH` pointing at a stub script in `test/fixtures/`. The stub blocks until the test creates a release file, so these tests don't depend on how fast the model is.
  - The web e2e `webServer` uses the same env, and tests reuse the api fixtures.

## Implementation Phases

### Phase 1: API: transcribe uploads and read the transcript (tracer bullet)

**Goal:** Every new upload is queued and transcribed locally right after the upload. The list shows each recording's status, and the owner and participants can read the finished text over the api.
**Affects:** backend / database
**Tasks:**

- [ ] Write the e2e tests first (`test/transcriptions.e2e-spec.ts`), the speech fixtures and the stub CLI. Run them and confirm they fail.
  - Uploading each supported format (MP4, WebM, MP3, M4A, WAV) returns at once with `transcription.status` `QUEUED` or `TRANSCRIBING`. With the blocking stub, the upload response still arrives.
  - `speech.mp3` and `speech.mp4` reach `DONE`, and the transcript contains the known words plus a detected language.
  - Three recordings uploaded in a row all reach `DONE` or `FAILED`, one at a time. None stays `QUEUED`.
  - A recording inserted without a transcription row (pre-feature) lists `transcription: null`, and its transcript endpoint returns `404`.
  - Transcript access: owner and invited participant `200`, outsider `404`, before `DONE` `409`.
- [ ] Add the `Transcription` model, both enums and the migration. Add the `FFMPEG_PATH`, `WHISPER_CLI_PATH` and `WHISPER_MODEL_PATH` config with validation, and the `whisper:model` script.
- [ ] Generate the `transcriptions` CQRS module. Publish `RecordingUploadedEvent` from `UploadRecordingHandler` after the commit, and create the `QUEUED` row in its handler. Add the sequential worker: claim by compare-and-set, `ffmpeg` to a temp WAV, `whisper-cli` to text, save by compare-and-set, delete the temp file.
- [ ] Add `transcription` to the list response and `GET .../transcript` (`GetTranscriptQuery`, access through `GetMeetingQuery`).
- [ ] Add unit tests for the worker, the process runner (arguments, exit codes, temp cleanup) and the handlers. Update `apps/api/CLAUDE.md` (module, env, binaries, test setup), the root `CLAUDE.md` (manual setup) and `.env.example`. Run the Phase 1 e2e tests and confirm they now pass.

**Done criteria:** All Phase 1 e2e tests that were red at the start now pass, along with the existing api e2e suite. A code review confirms that no transcription code makes network calls. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.

### Phase 2: Web: transcription status and transcript view

**Goal:** On the meeting page, each recording shows its transcription status, which updates without a reload, and a finished transcript can be opened.
**Affects:** frontend
**Tasks:**

- [ ] Write the web e2e tests first (`e2e/recording-transcription.spec.ts`). Run them and confirm they fail.
  - After an upload, the recording shows "Queued" or "Transcribing".
  - With the page open, the status changes to "Done" without a reload.
  - Owner and invited participant open the transcript and see the known words.
  - A pre-feature recording shows no status, and there are no console errors.
- [ ] Add the transcription types and api calls to `src/lib/api/` (list field, `getTranscript`).
- [ ] Add a status badge to each recording row, and poll the list while any recording is `QUEUED` or `TRANSCRIBING`. Polling stops when none are and when the page unmounts.
- [ ] Add a transcript view for `DONE` recordings (open/close, readable long text, loading and error states), responsive on desktop and mobile.
- [ ] Update `apps/web/CLAUDE.md`. Run the `ui-ux-pro-max` review and take Playwright MCP screenshots at 375, 1440 and 1920 px. Run the Phase 2 e2e tests and confirm they now pass.

**Done criteria:** All Phase 2 web e2e tests that were red at the start now pass, and the Phase 1 api e2e tests still pass. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

### Phase 3: API: failures, retry, deletion and restart recovery

**Goal:** Failed transcriptions end with a reason and the owner can retry them. Deleting a recording mid-run leaves nothing behind, and an api restart doesn't leave transcriptions stuck.
**Affects:** backend
**Tasks:**

- [ ] Write the e2e tests first (`test/transcription-failures.e2e-spec.ts`). Run them and confirm they fail.
  - `corrupt.mp4` → `FAILED` / `UNREADABLE_FILE`, `silence.wav` → `FAILED` / `NO_SPEECH`, a missing binary → `FAILED` / `SERVER_ERROR`. The other recordings in the meeting still list and transcribe.
  - Retry: owner on `FAILED` → `QUEUED`, and it runs again. Participant `403`, outsider `404`, not `FAILED` `409`.
  - Delete while `QUEUED` and while `TRANSCRIBING` (blocking stub, then release) → the recording and transcript are gone, and no row reappears.
  - Close the app with rows `QUEUED` and `TRANSCRIBING`, then start it again → both reach `DONE` or `FAILED`.
- [ ] Map failures to reasons: `ffmpeg` errors → `UNREADABLE_FILE`, empty or blank-audio output → `NO_SPEECH`, anything else (missing binary, crash, timeout) → `SERVER_ERROR`. A failure never stops the worker.
- [ ] Add `RetryTranscriptionCommand` and `POST .../transcription/retry` (`MeetingOwnerGuard`, compare-and-set `FAILED` → `QUEUED`, wake the worker).
- [ ] On startup, reset `TRANSCRIBING` rows to `QUEUED` and drain the queue. Make sure the result save is skipped when the row has been deleted.
- [ ] Add unit tests for the failure mapping, the retry handler and startup recovery. Update `apps/api/CLAUDE.md`. Run the Phase 3 e2e tests and confirm they now pass.

**Done criteria:** All Phase 3 e2e tests that were red at the start now pass, along with the Phase 1 e2e tests. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.

### Phase 4: Web: failed status and retry

**Goal:** A failed transcription shows its reason on the meeting page, and the owner can retry it from there.
**Affects:** frontend
**Tasks:**

- [ ] Write the web e2e tests first (extend `e2e/recording-transcription.spec.ts`). Run them and confirm they fail.
  - A failed recording shows "Failed" with a readable reason. Playback, download and the other recordings still work.
  - The owner sees "Retry". After clicking it, the status shows "Queued" and then updates without a reload. An invited participant sees no "Retry".
  - Deleting a recording while it is transcribing removes it from the list, and it doesn't come back on the next poll.
- [ ] Add `retryTranscription` to `src/lib/api/` and user-readable texts for each `TranscriptionFailure`.
- [ ] Show the Failed state with its reason and an owner-only "Retry" button (pending state, error message on failure). Polling resumes after a retry.
- [ ] Check the layout of all four statuses and the transcript view on desktop and mobile.
- [ ] Update `apps/web/CLAUDE.md`. Run the `ui-ux-pro-max` review and take Playwright MCP screenshots at 375, 1440 and 1920 px. Run the Phase 4 e2e tests and confirm they now pass.

**Done criteria:** All Phase 4 web e2e tests that were red at the start now pass. The Phase 2 web and the Phases 1 and 3 api e2e suites still pass. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Coverage of the PRD readiness criteria

| PRD criterion                                            | Phase |
| -------------------------------------------------------- | ----- |
| Upload of all formats → "Queued"/"Transcribing"          | 1, 2  |
| Speech recording → "Done" with the spoken words          | 1, 2  |
| Status changes without a manual reload                   | 2     |
| Transcript for owner/participant, "not found" for others | 1, 2  |
| Untranscribable file → "Failed" with a reason            | 3, 4  |
| Owner-only retry, participant refused                    | 3, 4  |
| Several uploads in a row all finish                      | 1     |
| Restart doesn't leave transcriptions stuck               | 3     |
| Delete during transcription leaves no transcript         | 3, 4  |
| Pre-feature recordings: no status, no errors             | 1, 2  |
| Upload doesn't wait for transcription                    | 1     |
| No data sent to external services                        | 1     |
| Desktop and mobile layout                                | 2, 4  |
