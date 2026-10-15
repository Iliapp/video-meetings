# PRD: Meeting recording upload

**Date**: 2026-10-09
**Status**: Draft

## Goal

The meeting owner uploads recordings of a meeting so that the owner and invited participants keep them in one place, linked to the meeting, and can watch, listen to or download them later. The stored recordings are the input for processing features in later iterations, such as transcription and summaries.

## User scenarios

- Owner opens a meeting → sees its details and a "Recordings" section with an upload control.
- Owner picks or drags in a supported file within the size limit → sees upload progress, then the recording appears in the list.
- Owner picks a file with an unsupported format or above the size limit → the upload doesn't start and an error names the reason (format or size).
- Owner's upload fails (network or server error) → sees an error and can retry. No broken entry is left in the list.
- Owner uploads several files to the same meeting → all of them are listed, newest first.
- Owner or invited participant opens a meeting → sees the list of recordings with file name, type (video or audio), size, duration, upload date and uploader.
- Owner or invited participant plays a recording → a video or audio player opens in the meeting page.
- Owner or invited participant clicks "Download" → gets the original file.
- Owner deletes a recording and confirms → the recording is removed from the list for everyone and can no longer be played or downloaded.
- Invited participant opens a meeting → doesn't see the upload or delete controls.
- User who is neither the owner nor invited opens the meeting or a recording link → gets "not found". The file isn't revealed.
- User opens the dashboard → can open any listed meeting's page.

## In scope

- A meeting page in the web app showing meeting details (title, date, participants) and its recordings. The dashboard links to it.
- Upload of meeting recordings by the meeting owner: file picker and drag-and-drop, upload progress, cancel during upload.
- Supported formats: video MP4 and WebM; audio MP3, M4A and WAV. Maximum file size: 2 GB per file.
- Several recordings per meeting.
- Persistent storage of the original file and its metadata: file name, type, size, duration, upload date, uploader and meeting.
- A list of recordings on the meeting page, newest first, with an empty state when there are none.
- In-page playback of video and audio recordings.
- Download of the original file by the owner and invited participants.
- Deletion of a recording by the owner, after confirmation. This removes both the file and its metadata.
- Access control: only the owner can upload and delete. Only the owner and invited participants can list, play and download. Everyone else gets "not found".
- Clear error messages for an unsupported format, a file that is too large, a failed upload and no access.
- Responsive layout for desktop and mobile.

## Out of scope

- Any processing of recordings: transcription, summaries, action items, format conversion, thumbnails, compression.
- Recording a meeting in the app (live capture or WebRTC). Only files recorded elsewhere are uploaded.
- Non-recording attachments: documents, slides, images.
- Upload or deletion by invited participants.
- Renaming or replacing a recording, versioning, and restoring deleted recordings.
- Public or share links for people outside the meeting.
- Storage quotas per user or per meeting, and billing.
- Resuming an interrupted upload after a page reload.
- Notifications to participants when a recording is added.

## Criterion of readiness

- [ ] From the dashboard, a user can open a page for any meeting they own or are invited to. The page shows the title, date, participants and a "Recordings" section.
- [ ] The owner can upload an MP4, WebM, MP3, M4A or WAV file of up to 2 GB. After the upload finishes, the file appears in the list without a page reload.
- [ ] Progress is shown during upload, and cancelling stops it without adding the file to the list.
- [ ] A file in another format, or one larger than 2 GB, is rejected with a message that names the reason. Nothing is stored.
- [ ] If an upload fails, the owner sees an error and can retry. No partial entry appears in the list.
- [ ] A meeting can hold at least 10 recordings, listed newest first, each with name, type, size, duration, upload date and uploader.
- [ ] A meeting without recordings shows an empty state. For the owner, it includes an upload action.
- [ ] The owner and invited participants can play every listed video and audio recording on the meeting page.
- [ ] The owner and invited participants can download a recording. The downloaded file is byte-identical to the one uploaded.
- [ ] The owner can delete a recording after confirming. It then disappears from the list and its playback and download links return "not found" for everyone.
- [ ] Invited participants see no upload or delete controls. Their direct upload or delete requests to the api are rejected.
- [ ] A user who is neither the owner nor invited gets "not found" for the meeting page, its recordings list, and playback or download of any of its recordings.
- [ ] Recordings and their metadata are still there after the api restarts.
- [ ] The meeting page works without horizontal scroll at 375, 1440 and 1920 px widths, with no console errors.
- [ ] Unit and e2e tests cover upload, list, download, delete and the access rules. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
