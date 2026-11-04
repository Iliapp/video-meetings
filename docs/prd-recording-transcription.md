# PRD: Recording transcription

**Date**: 2026-10-31
**Status**: Draft

## Goal

Every recording uploaded to a meeting is transcribed automatically, right after the upload, by a local Whisper model. The owner and invited participants can see how the transcription is going and read the meeting's text without listening to the whole recording. Recordings never leave our server.

## User scenarios

- Owner uploads a recording → it appears in the list with the transcription status "Queued", and transcription starts without any extra action.
- Owner or invited participant opens the meeting page while a recording is being transcribed → sees the status "Transcribing" on that recording.
- Transcription finishes while the meeting page is open → the status changes to "Done" without a page reload, and the transcript can be opened.
- Owner or invited participant opens the transcript of a finished recording → sees the full text on the meeting page.
- Transcription fails (damaged file, no speech, server error) → the status is "Failed" with a short reason, and the rest of the meeting page keeps working.
- Owner clicks "Retry" on a failed transcription → the status goes back to "Queued" and transcription runs again.
- Invited participant sees a failed transcription → sees the status, but no "Retry" control.
- Owner uploads several recordings in a row → each one gets its own status and is transcribed one after another. None of them is skipped.
- Owner deletes a recording while it is queued or being transcribed → the recording and its transcript disappear for everyone, and no transcript appears for it later.
- User who is neither the owner nor invited requests a transcript or its status → gets "not found".
- Recording uploaded before this feature → shows no transcription status and no transcript.

## In scope

- Automatic transcription of every newly uploaded recording in all supported formats: video MP4 and WebM, audio MP3, M4A and WAV. For video, only the audio track is transcribed.
- Transcription by a Whisper model running locally on the api server, using a small, low-cost model. No external transcription services.
- Automatic detection of the spoken language.
- Transcription status per recording: Queued, Transcribing, Done, Failed. A failed transcription keeps a short, user-readable reason.
- Status shown in the recordings list on the meeting page for the owner and invited participants. It updates without a page reload while transcription is in progress.
- Viewing the transcript text of a finished recording on the meeting page, for the owner and invited participants.
- Retry of a failed transcription, by the owner only.
- Transcription keeps working after the api restarts: recordings left Queued or Transcribing are transcribed again, so none of them stays stuck.
- Deleting a recording also deletes its transcript.
- The same access rules as for recordings: everyone except the owner and invited participants gets "not found".
- Responsive layout for desktop and mobile.

## Out of scope

- Transcribing recordings uploaded before this feature, and a way to transcribe them manually.
- Choosing the language or the model, and larger or more accurate models.
- Speaker labels (diarization) and timestamps in the shown text.
- Editing, searching or downloading the transcript.
- Summaries, action items or any other processing of the transcript.
- Live transcription during a meeting.
- Cancelling a transcription that is in progress (other than deleting the recording).
- Notifications (email or in-app) when a transcription finishes or fails.
- A progress percentage inside the "Transcribing" status.

## Criterion of readiness

- [ ] After a successful upload of an MP4, WebM, MP3, M4A or WAV file, the recording shows the status "Queued" or "Transcribing" without any further action.
- [ ] A short test recording with clear speech reaches "Done", and its transcript contains the spoken words.
- [ ] While the meeting page is open, the status changes from "Transcribing" to "Done" or "Failed" without a manual reload.
- [ ] The owner and an invited participant can open the transcript of a "Done" recording. A user without access gets "not found" for the transcript and the status.
- [ ] A file that can't be transcribed ends with "Failed" and a reason. The meeting page and the other recordings keep working.
- [ ] Only the owner sees "Retry" on a failed transcription. After it, the status goes back to "Queued" and the transcription runs again. A participant's retry request is refused.
- [ ] Several recordings uploaded in a row all reach "Done" or "Failed". None stays "Queued".
- [ ] After an api restart, recordings that were "Queued" or "Transcribing" reach "Done" or "Failed".
- [ ] Deleting a recording during transcription removes it and its transcript, and no transcript is saved for it afterwards.
- [ ] Recordings uploaded before this feature show no status and no errors.
- [ ] Upload speed and the upload response don't wait for transcription.
- [ ] No recording data is sent to external services.
- [ ] The status and the transcript display correctly on desktop and mobile.
