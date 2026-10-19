# PRD: User profile

**Date**: 2026-10-18
**Status**: Draft

## Goal

A signed-in user has a profile page where they set a display name, upload an avatar and change their password. The name and avatar appear in the header on every signed-in page, so users recognise their account at a glance instead of seeing only an email.

## User scenarios

- Signed-in user clicks their avatar or name in the header → opens the profile page.
- User opens the profile page → sees their avatar (or initials), name, email (read-only) and the password change form.
- User enters a name and saves → sees "Profile updated"; the header and the dashboard greeting show the new name without a page reload.
- User clears the name (empty or only spaces) and saves → the name is removed and the header and greeting fall back to the email.
- User enters a name longer than 100 characters → the name isn't saved and an error names the reason.
- User uploads a JPG, PNG or WebP image up to 5 MB → sees a preview, then the new avatar in the profile and header.
- User picks a file of another format or above 5 MB → the upload doesn't start and an error names the reason (format or size).
- User's avatar upload fails (network or server error) → sees an error and can retry; the previous avatar stays.
- User removes their avatar and confirms → the profile and header show initials again.
- User without an avatar → sees a circle with initials of the name (or the first letter of the email when there is no name).
- User enters the correct current password, a new password of at least 8 characters and the same new password in the confirmation field → sees "Password changed", stays signed in, and from now on signs in only with the new password.
- User enters a wrong current password → sees "Current password is incorrect"; the password doesn't change.
- User enters a new password shorter than 8 characters, or a confirmation that doesn't match → the form isn't sent and the field shows the error.
- User signs out and in again, or opens the app in another browser → sees the same name and avatar.
- Signed-out user opens the profile page → is redirected to `/login`.

## In scope

- A `/profile` page for the signed-in user, linked from the header.
- Display name: optional, trimmed, 1–100 characters when set; an empty or whitespace-only field clears it (the web sends `null`). Registration doesn't change.
- Avatar: upload (file picker) of JPG, PNG or WebP up to 5 MB, the real file type checked on the server; replace; remove with confirmation. Shown as a circle, cropped to fit; no cropping tool.
- Initials fallback when there is no avatar.
- Password change: current password, new password (min 8 characters, as at registration), confirmation. The current session stays active.
- Header on all signed-in pages shows the avatar and the name (email when no name), and links to the profile.
- Dashboard greeting uses the name, falling back to the email.
- Name and avatar are stored on the server and are the same on every device.

## Out of scope

- Changing the email.
- Showing other users' names or avatars (meeting participants, recording uploader).
- Avatar cropping, rotation or filters; drag-and-drop upload.
- Signing out other sessions or invalidating existing tokens after a password change. The risk is bounded by the token lifetime (`JWT_EXPIRES_IN`, 1 h by default).
- Password reset by email ("forgot password").
- Account deletion.
- Collecting the name at registration.

## Criterion of readiness

- [ ] A signed-in user can open `/profile` from the header; a signed-out user opening `/profile` is redirected to `/login`.
- [ ] The profile page shows the user's email (not editable), name and avatar or initials.
- [ ] Saving a valid name shows "Profile updated" and updates the header and dashboard greeting without a reload; the name persists after signing out and in.
- [ ] Clearing the name (empty or whitespace-only field) makes the header and greeting show the email.
- [ ] A name longer than 100 characters is rejected by both the web form and the api, with an error message; the api also rejects an empty or whitespace-only string (the web sends `null` instead).
- [ ] Uploading a JPG, PNG or WebP ≤ 5 MB replaces the avatar in the profile and header; the avatar persists after signing out and in.
- [ ] A file of another format, or a file with an image extension whose content isn't JPG/PNG/WebP, is rejected by the api; the web shows the format error before uploading for a wrong extension.
- [ ] A file above 5 MB is rejected before upload in the web and by the api.
- [ ] A failed avatar upload shows an error with a retry option and keeps the previous avatar.
- [ ] Removing the avatar after confirmation shows initials in the profile and header; the old image is no longer served.
- [ ] Without an avatar, the initials come from the name, or from the email's first letter when there is no name.
- [ ] Changing the password with the correct current password shows "Password changed"; the user stays signed in; signing in with the old password fails and with the new one succeeds.
- [ ] A wrong current password shows "Current password is incorrect" next to the field, the user stays signed in, and the password stays the same.
- [ ] A new password under 8 characters or a non-matching confirmation shows a field error and sends no request; the api also rejects a new password under 8 characters.
- [ ] A user can read and change only their own profile, avatar and password.
- [ ] The profile page and header work at 375, 1440 and 1920 px without horizontal scroll, and with keyboard only.
- [ ] api e2e tests and web Playwright e2e tests cover the scenarios above.
