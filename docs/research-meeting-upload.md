# Research: meeting recording upload

**Plan**: [docs/plan-meeting-recording-upload.md](plan-meeting-recording-upload.md)
**PRD**: [docs/prd-meeting-recording-upload.md](prd-meeting-recording-upload.md)
**Date:** 2026-10-17

This document picks the libraries and techniques for each technical decision in the plan. It is based on the versions installed in the repo (checked in `node_modules`), not on general advice.

## Summary

| Concern                | Recommendation                                                                                                                  | New dependency                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Upload transport       | One `multipart/form-data` request, parsed by multer through Nest's `FileInterceptor` with **disk storage**. No resumable upload | `@types/multer` (dev)                           |
| Access check           | A guard that runs **before** the interceptor, so outsiders and invitees are rejected before any bytes are read                  | none                                            |
| Size limit             | multer `limits.fileSize` (→ `413`), plus an early `Content-Length` check                                                        | none                                            |
| Format check           | `file-type` `fileTypeFromFile()` on the stored temp file, mapped to an allow-list. **Not** Nest's `FileTypeValidator`           | `file-type` (already installed via Nest)        |
| Storage layout         | `RECORDINGS_DIR/incoming/<uuid>` while uploading, atomic `rename` to `RECORDINGS_DIR/<uuid>` once valid, then the DB row        | none                                            |
| Long uploads           | Raise `server.requestTimeout` on `app.getHttpServer()` before `listen`                                                          | none                                            |
| Signed URLs            | HMAC-SHA256 token (`recordingId`, purpose, expiry), key derived from `JWT_SECRET` with HKDF                                     | none                                            |
| Stream / download      | Express `res.sendFile()` / `res.download()` (the `send` package): Range, `206`, `416`, ETag, `filename*` for free               | none                                            |
| Web upload             | `XMLHttpRequest` + `FormData`: `upload.onprogress`, `abort()` for cancel, retry = new request                                   | none                                            |
| Web duration           | Off-DOM `<video>`/`<audio>` with `preload="metadata"` on an object URL, with a timeout                                          | none                                            |
| Drag-and-drop / picker | `DropZone` + `FileTrigger` from `react-aria-components` (the same React Aria HeroUI is built on)                                | `react-aria-components` (web, pin HeroUI's 1.x) |
| Playback / URL refresh | Native `<video>` / `<audio>` on the signed URL; on `error`, refetch URLs and restore `currentTime`                              | none                                            |

## What is installed today

- api: NestJS 12.1, `@nestjs/platform-express` 12 with **Express 5.2.1** and **multer 2.4.0** (busboy 1.6). `@nestjs/common` depends on **`file-type` 22.1.1** (ESM-only). Prisma 7.10. The global `ValidationPipe` uses `{ whitelist: true, transform: true }`.
- web: Next.js 16.3, React 19.2, HeroUI 3.2 (`progress-bar`, `alert-dialog`, `modal`, `toast`, `empty-state`, `table` are available). HeroUI pulls in `react-aria-components` 1.21.1 but does not re-export `DropZone` or `FileTrigger`.
- Node's HTTP server defaults: `requestTimeout` 300 000 ms, `headersTimeout` 60 000 ms, `timeout` 0.

## 1. Upload transport (api)

### Options compared

| Option                                                          | Pros                                                                                                                                   | Cons                                                                                                                          | Verdict                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Multipart + multer disk storage (`FileInterceptor`)**         | Built into Nest; streams to disk (constant memory); multer 2.4 removes partial files on abort and on limit errors; standard `FormData` | Multipart overhead; client filename needs a charset option (see below)                                                        | **Use**                                               |
| Multipart + multer memory storage                               | Nest's `FileTypeValidator` works out of the box                                                                                        | Buffers up to 2 GB in RAM per request                                                                                         | Reject                                                |
| Raw body `PUT` (`application/octet-stream`) + `stream.pipeline` | Exact `Content-Length`; no multipart parsing                                                                                           | File name and duration move into headers (non-ASCII encoding problems), custom code for abort cleanup, not what the plan says | Reject                                                |
| Resumable (tus: `@tus/server` + `@tus/file-store`, Uppy)        | Survives network drops on 2 GB files                                                                                                   | Separate protocol, extra state, more surface; the PRD lists resume after reload as out of scope                               | Not now. Revisit if users report failed large uploads |
| Custom chunked upload                                           | Fine-grained retry                                                                                                                     | Reinvents tus                                                                                                                 | Reject                                                |
| Presigned direct-to-object-storage                              | Takes upload load off the api                                                                                                          | Storage is local disk by decision                                                                                             | Possible later behind the storage service             |

Do not route uploads through Next.js (Server Actions or rewrites): they have small body limits and would double the traffic. The browser already calls the api directly, and uploads should too.

### Request lifecycle

Nest runs **guards → interceptors → pipes → handler**. multer reads the body inside the interceptor, so anything that can reject the request without the file must be a guard:

1. `JwtAuthGuard`: `401`.
2. `MeetingOwnerGuard` (new, in `recordings/`): dispatches `GetMeetingQuery` on the `QueryBus`. Not visible → `404`; visible but not the owner → `403`. It also rejects early with `413` when `Content-Length` is larger than `RECORDINGS_MAX_BYTES + 64 KiB` (an allowance for multipart overhead). The exact limit is still enforced by multer.
3. `FileInterceptor('file')`: streams the body to `RECORDINGS_DIR/incoming/<uuid>`.
4. Handler (command): format check, `rename`, DB row, cleanup on any failure.

Without step 2, an outsider could make the server write 2 GB before getting a `404`.

### multer configuration

Register options once per module, so env values come from `ConfigService`:

```ts
MulterModule.registerAsync({
  inject: [ConfigService, RecordingsStorage],
  useFactory: (config: ConfigService, storage: RecordingsStorage) => ({
    storage: diskStorage({
      destination: storage.incomingDir, // RECORDINGS_DIR/incoming, created on startup
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: {
      fileSize: config.get('RECORDINGS_MAX_BYTES'),
      files: 1,
      fields: 5,
      parts: 6,
    },
    defParamCharset: 'utf8',
  }),
});
```

- **`defParamCharset: 'utf8'` is required.** multer's default is `latin1`, so a browser-sent `filename="Зустріч.mp4"` becomes mojibake in `file.originalname`. The plan's non-ASCII download test would fail without it.
- `LIMIT_FILE_SIZE` is mapped by Nest to `PayloadTooLargeException` (`413`) with multer's message "File too large". To name the reason as the PRD asks ("File is larger than 2 GB"), add a small exception filter on the controller, or wrap the interceptor and rethrow `413` with a custom message.
- multer 2.4 listens for `aborted` / `close` on the request and removes the files it has written. The "aborted upload leaves nothing behind" criterion is covered by multer, as long as no DB row is created before the handler runs (it isn't).
- Treat `file.originalname` as untrusted: take `path.basename`, normalize to NFC, strip control characters, and cap the length (for example 255). It is only stored as metadata and used in `Content-Disposition`.

### Duration field

Send it as a text part before the file. Validate it with the global pipe:

```ts
export class UploadRecordingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  durationSeconds?: number;
}
```

The plan says an invalid value is stored as `null`, not rejected. Either relax this (`@Transform` that turns non-finite values into `undefined`) or return `400`. Returning `400` is simpler and the web never sends invalid values. Pick one and write it into the plan.

### Long uploads

`requestTimeout` (300 s) limits the whole request, including the body. At 10 Mbit/s a 2 GB file takes about 27 minutes. Set it on the server Nest already created, before `listen`:

```ts
const server = app.getHttpServer() as import('node:http').Server;
server.requestTimeout = 2 * 60 * 60 * 1000; // 2 h; 0 disables it
```

Prefer a large finite value over `0`, which turns off Node's slow-request protection for every route. e2e tests boot `AppModule` without `main.ts`, so this setting isn't exercised there. Put it in an exported `configureHttpServer(app)` helper if you want a unit test for it.

## 2. Format validation

### Why not Nest's `FileTypeValidator`

In Nest 12 `FileTypeValidator` calls `fileTypeFromBuffer(file.buffer)`. With disk storage there is no `buffer`, so it either always fails or, with `fallbackToMimetype`, trusts the client's `Content-Type`. The plan forbids the second.

### Use `file-type` directly

`file-type` 22.1.1 is already in the tree. Add it as a direct api dependency with the same version, so pnpm resolves it from `src/`. Run `fileTypeFromFile(path)` on the temp file. It reads only the first few KB.

It is ESM-only. Load it the same way Nest does, with `await import('file-type')`, which works in the CJS build and in Jest (the scripts already run with `--experimental-vm-modules`). Wrap it in the storage service or a `detectMediaType()` helper so unit tests can mock it.

### Allow-list

What `file-type` 22 returns for each format (checked in its source):

| Extension | Accepted detections (`ext` / `mime`)   | Stored MIME  | Kind  |
| --------- | -------------------------------------- | ------------ | ----- |
| `.mp4`    | `mp4` `video/mp4`, `m4v` `video/x-m4v` | `video/mp4`  | video |
| `.webm`   | `webm` `video/webm`                    | `video/webm` | video |
| `.mp3`    | `mp3` `audio/mpeg`                     | `audio/mpeg` | audio |
| `.m4a`    | `m4a` `audio/x-m4a`, `mp4` `video/mp4` | `audio/mp4`  | audio |
| `.wav`    | `wav` `audio/wav`                      | `audio/wav`  | audio |

Points to keep in mind:

- MP4 and M4A are the same ISO-BMFF container. `file-type` decides by the `ftyp` major brand, and many encoders write `isom` / `mp42` into `.m4a` files. That makes the extension the deciding signal, and magic bytes only confirm the container family. Accepting `mp4` for `.m4a` is required.
- `file-type` reports **audio-only WebM** (what `MediaRecorder` produces with `audio/webm`) as `video/webm`. With the plan's rule (extension decides), every `.webm` is `kind = video`. An audio WebM then plays in a `<video>` element, which works, just with an empty frame. If that is not acceptable, a later improvement is to parse the EBML `Tracks` element for a video track. Not needed for this feature.
- Detection fails (`undefined`) or doesn't match the extension → `415 Unsupported Media Type` (`UnsupportedMediaTypeException`) with a message such as "Unsupported file format. Allowed: MP4, WebM, MP3, M4A, WAV". Delete the temp file.
- Check the extension early in a multer `fileFilter` too, so a `.exe` is rejected before the body is written. `fileFilter` can't return a status, so throw `UnsupportedMediaTypeException` from it (multer passes the error through and Nest keeps `HttpException`s as they are).

## 3. Storage layout and consistency

```
RECORDINGS_DIR/
  incoming/<uuid>   # being written by multer, or awaiting validation
  <uuid>            # valid, referenced by a Recording row
```

Upload command, in order:

1. Detect the type of `incoming/<uuid>`. Invalid → unlink, `415`.
2. `fs.rename(incoming/<uuid>, <uuid>)`. Same directory tree, so same filesystem and atomic.
3. `prisma.recording.create({ storageKey: uuid, ... })`. Failure → unlink `<uuid>` and rethrow.

On startup the storage service creates both directories (`mkdir -p`) and empties `incoming/`. That is enough to clean up after a crash mid-upload. A crash between steps 2 and 3 can leave an unreferenced `<uuid>`; that is rare and harmless. A reconciliation job isn't worth it now.

Storage service interface, so the rest of the code doesn't know about paths:

```ts
interface RecordingsStorage {
  incomingDir: string;
  commit(tempPath: string): Promise<string>; // returns storage key
  pathFor(key: string): string; // for sendFile, validates key is a UUID
  remove(key: string): Promise<void>; // ignores ENOENT
}
```

`pathFor` must accept only UUIDs and returns an absolute path, so a key can never escape the directory.

Prisma model, matching the plan:

```prisma
enum RecordingKind {
  video
  audio
}

model Recording {
  id               String        @id @default(uuid()) @db.Uuid
  meetingId        String        @map("meeting_id") @db.Uuid
  meeting          Meeting       @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  uploaderId       String        @map("uploader_id") @db.Uuid
  uploader         User          @relation(fields: [uploaderId], references: [id], onDelete: Cascade)
  originalName     String        @map("original_name")
  mimeType         String        @map("mime_type")
  kind             RecordingKind
  sizeBytes        BigInt        @map("size_bytes")
  durationSeconds  Float?        @map("duration_seconds")
  storageKey       String        @unique @map("storage_key") @db.Uuid
  createdAt        DateTime      @default(now()) @map("created_at")

  @@index([meetingId, createdAt(sort: Desc)])
  @@map("recordings")
}
```

- `sizeBytes` must be `BigInt`: `Int` is 32-bit and overflows at 2 GiB. Serialize it as a number in responses (it is far below `Number.MAX_SAFE_INTEGER`). `JSON.stringify` throws on `BigInt`, so map it in the query handler.
- `onDelete: Cascade` on the meeting deletes rows but not files. There is no meeting delete yet. When one is added, it must remove the files too.

## 4. Signed URLs

### Token

A compact HMAC token is enough. It does not need to be a JWT:

```
token = base64url(recordingId "." purpose "." expUnixSeconds) "." base64url(HMAC-SHA256(key, payload))
purpose ∈ { "stream", "download" }
```

- Key: `crypto.hkdfSync('sha256', JWT_SECRET, '', 'recording-urls', 32)`. No new secret env var, and the key differs from the one that signs access tokens, so neither kind of token can be used as the other.
- Verify with `crypto.timingSafeEqual`, then check `exp`, `purpose`, and that the `recordingId` in the token matches the path. Then load the row. Any failure, including a deleted row → `404`, as the plan says.
- If you'd rather reuse `@nestjs/jwt`, sign with that derived key and an `aud` per purpose. Do not sign with `JWT_SECRET` directly: `JwtAuthGuard` would accept the URL token as a Bearer token.
- `RECORDING_URL_TTL`: parse it like `JWT_EXPIRES_IN` (`1h`, `6h`). A default of `6h` covers a long viewing session. e2e sets a few seconds to test expiry.

### Routes

```
GET  /meetings/:id/recordings/:recordingId/urls   Bearer   → { streamUrl, downloadUrl, expiresAt }
GET  /recordings/:recordingId/stream?token=…      token    → 200 / 206 / 416 / 404
GET  /recordings/:recordingId/download?token=…    token    → 200 / 206 / 404
```

Stream and download sit outside `/meetings/:id`, because the token alone authorizes them. URLs are absolute, built from a configured public base (`API_PUBLIC_URL`, or derived from the request) so the web can put them in `src`.

Tokens in query strings end up in access logs. That is acceptable with a short TTL. Don't log full URLs at `info` level in the api.

## 5. Streaming and download

Nest's `StreamableFile` does not handle `Range`. Express 5's `res.sendFile` / `res.download` (the `send` package) handle everything the plan needs: a single `Range` → `206` with `Content-Range`, unsatisfiable → `416`, `Accept-Ranges`, `ETag` / `Last-Modified`, conditional `304`, `HEAD`.

```ts
@Get(':recordingId/stream')
async stream(@Param() p, @Query('token') token: string, @Res() res: Response) {
  const rec = await this.queryBus.execute(new ResolveSignedRecordingQuery(p.recordingId, token, 'stream')); // 404 on any failure
  res.sendFile(this.storage.pathFor(rec.storageKey), {
    headers: {
      'Content-Type': rec.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
}
```

- Stored files have no extension, so `send` would guess `application/octet-stream`. Passing `Content-Type` in `headers` is enough: `send` applies `headers` before it guesses the type and skips the guess when the header is already set (checked in `send@1`).
- Download: `res.download(path, rec.originalName, { headers: {...} })`. It builds `Content-Disposition` with the `content-disposition` package: `attachment; filename="?????.mp4"; filename*=UTF-8''%D0%97...`. That meets the `filename*` requirement without hand-written encoding.
- With `@Res()`, Nest's interceptors don't format the response. Exceptions thrown **before** `sendFile` still go through the normal filters, so the token check returns a normal `404`.
- The token check runs before `send` reads `Range`, so "invalid token + Range → `404`" works as written.
- No CORS is needed: `<video src>` without `crossorigin` and top-level navigation for downloads are not CORS requests.

## 6. Delete

`DELETE /meetings/:id/recordings/:recordingId` behind `MeetingOwnerGuard`: delete the row, then `storage.remove(key)` with errors logged, not thrown, as the plan says. URLs issued before the delete fail on the row lookup → `404`.

## 7. Web: upload client

`fetch` cannot report upload progress. Streaming request bodies (`duplex: 'half'`) work only in Chromium over HTTP/2, and the api is HTTP/1.1. Use `XMLHttpRequest`:

```ts
export function uploadRecording(
  meetingId: string,
  file: File,
  durationSeconds: number | undefined,
  token: string,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<Recording> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/meetings/${meetingId}/recordings`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(e.loaded, e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.response)
        : reject(new ApiError(xhr.status, xhr.response?.message));
    xhr.onerror = () => reject(new ApiError(0, 'Network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    const body = new FormData();
    if (durationSeconds !== undefined)
      body.append('durationSeconds', String(durationSeconds));
    body.append('file', file); // last, after the text fields
    xhr.send(body);
  });
}
```

- Put it in `src/lib/api.ts` next to the existing functions and reuse `ApiError`. Don't set `Content-Type` yourself; the browser adds the boundary.
- Cancel = `AbortController.abort()`. multer cleans up on the server. Retry = call the function again with the same `File` (the browser keeps the reference).
- Pre-checks before sending: extension in the allow-list, `file.size <= NEXT_PUBLIC_RECORDINGS_MAX_BYTES`. Show the same reasons as the api.
- **Early server responses can look like network errors.** When the api answers `403` / `413` / `415` while the browser is still sending, Chromium often reports `net::ERR_CONNECTION_RESET` (`status 0`) instead of the response. Two consequences: the web must pre-check size and format so the user sees the real reason, and a `status 0` error should say "Upload failed, check your connection and retry", not claim a format or size problem.
- Progress ends at 100% before the server has validated and saved the file. Show "Processing…" between `upload.onload` and the response.
- Keep the page from being closed by accident with a `beforeunload` handler while an upload runs.

## 8. Web: reading the duration

```ts
export function readMediaDuration(
  file: File,
  timeoutMs = 5000,
): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement(
      file.type.startsWith('audio') ? 'audio' : 'video',
    );
    const url = URL.createObjectURL(file);
    const done = (d?: number) => {
      clearTimeout(t);
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
      el.load();
      resolve(d !== undefined && Number.isFinite(d) && d >= 0 ? d : undefined);
    };
    const t = setTimeout(() => done(), timeoutMs);
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done();
    el.src = url;
  });
}
```

- `MediaRecorder` WebM files have no `Duration` element, so `duration` is `Infinity`, and the function returns `undefined`, as planned. Seeking to a very large `currentTime` sometimes forces the browser to compute it, but that is unreliable across browsers. Skip it.
- A codec the browser can't decode triggers `error`; the upload still goes ahead without a duration.
- `file.type` can be empty for some extensions. Fall back to the extension.
- Heavier options (`mediainfo.js` WASM, server-side `ffprobe`) give exact durations for every file but add megabytes or a system binary. Not worth it for a display field.

## 9. Web: picker and drag-and-drop

HeroUI 3.2 has no file components. `react-aria-components` (which HeroUI is built on, 1.21.1 in the lockfile) has `DropZone` (drag-and-drop with keyboard and screen-reader support) and `FileTrigger` (hidden `<input type="file">` behind any pressable). Add it to `apps/web` at HeroUI's version (`pnpm --filter web add react-aria-components@^1.21.1`) so only one copy is installed. Style it with Tailwind and HeroUI tokens, and use HeroUI's `Button` inside `FileTrigger`.

Use `acceptedFileTypes` with both MIME types and extensions (`.mp4,.webm,.mp3,.m4a,.wav`), because some OSes report an empty or odd MIME type for `.m4a` / `.webm`.

HeroUI's `ProgressBar` shows progress, `AlertDialog` confirms deletes, `Toast` shows errors, and `EmptyState` covers the empty list.

## 10. Web: playback and expired URLs

- Open a modal with a native `<video controls>` or `<audio controls>`, with `src = streamUrl`. The browser sends Range requests, which the api supports.
- On the media element's `error` event (an expired token returns `404` on the next Range request): save `currentTime`, fetch `/urls` again, set the new `src`, then on `loadedmetadata` restore `currentTime` and call `play()` if it was playing. Allow one retry per error, so a deleted recording (`404` from `/urls`) shows "This recording was deleted" instead of looping.
- Download: fetch `/urls`, then `window.location.assign(downloadUrl)`. `Content-Disposition: attachment` keeps the user on the page. The `download` attribute doesn't work cross-origin, so don't rely on it.

## 11. Testing notes

### api e2e

- Fixtures: generate tiny files once with ffmpeg and commit them (a few KB each): `ffmpeg -f lavfi -i testsrc=d=1:s=64x64 -f lavfi -i sine=d=1 -shortest out.mp4`, the same for `.webm`; `-vn` for `.mp3`, `.m4a`, `.wav`. For the WebM without duration, record a short clip with `MediaRecorder` in Playwright, or remux with `ffmpeg -c copy -live 1`, and confirm the browser reports `Infinity`.
- "Renamed" fixture: copy `out.wav` to `fake.mp4`, plus a text file named `.mp3`.
- Size: set `RECORDINGS_MAX_BYTES` to a few KB in `setup-env.ts` and build an oversized buffer in the test. Keep it small (tens of KB): with large bodies supertest can hit `EPIPE` / `ECONNRESET` when the api answers `413` early, which makes the test flaky.
- Abort: open a raw `http.request`, write the multipart headers and part of the file, then `req.destroy()`. Poll `RECORDINGS_DIR` until `incoming/` is empty and assert there is no row.
- Range: `supertest(...).get(streamUrl).set('Range', 'bytes=0-99')` → `206`, `Content-Range: bytes 0-99/<size>`, 100 bytes.
- Restart: `app.close()`, create a new app from `AppModule`, list again.
- Each test file gets its own temp `RECORDINGS_DIR` (`fs.mkdtemp`) so parallel Jest workers don't share files.

### web e2e (Playwright)

- `webServer` as an array: the api (built, `node dist/main` with test env vars) and the web (`next dev` or `next build && next start` with `NEXT_PUBLIC_*` set). `reuseExistingServer: !process.env.CI`.
- Upload: `page.setInputFiles` on the `FileTrigger` input. For drag-and-drop, dispatch `dragenter` / `drop` with a `DataTransfer` built in `page.evaluate`, because Playwright can't drag files from the OS.
- Failure + retry: `page.route('**/recordings', route => route.abort())` once, then let the retry through.
- Download: `page.waitForEvent('download')`, then compare `download.path()` bytes to the fixture.

## 12. Production notes (outside the plan)

- A reverse proxy in front of the api needs `client_max_body_size 2g`, `proxy_request_buffering off` (otherwise nginx buffers 2 GB to its own disk first), and read timeouts that match `requestTimeout`.
- `RECORDINGS_DIR` must be on a persistent volume and backed up. Postgres backups alone don't cover it.
- Optionally check free space with `fs.statfs` in the guard before accepting `Content-Length` bytes.
- The storage service interface (`commit` / `pathFor` / `remove`) is where an S3 adapter would go later. Stream and download would then redirect to presigned URLs.

## Decisions to record in the plan

1. A `MeetingOwnerGuard` runs before `FileInterceptor`; access and `Content-Length` checks happen before any bytes are written.
2. Format detection uses `file-type` (`fileTypeFromFile`) directly, with the allow-list above. Nest's `FileTypeValidator` is not used.
3. multer gets `defParamCharset: 'utf8'`.
4. `Recording.sizeBytes` is `BigInt`.
5. Files go through `RECORDINGS_DIR/incoming/` and are renamed into place; `incoming/` is emptied on startup.
6. Signed URL tokens are HMAC-signed with a key derived from `JWT_SECRET` (HKDF); no new secret env var. A public base URL for the api (`API_PUBLIC_URL`) may be needed to build absolute links.
7. An invalid `durationSeconds`: `400` or stored as `null` (the plan says `null`; this needs a decision).
8. New dependencies: api `file-type` (direct, same version as Nest's) and `@types/multer`; web `react-aria-components`.
