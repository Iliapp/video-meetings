# PRD: Email verification

**Date**: 2026-10-27
**Status**: Draft

## Goal

Users prove that they own the email address of their account. Meeting invitations are addressed by email, so today anyone who registers with an invitee's address before that person does sees the invitee's meetings and can play and download their recordings. With verification, an invitation grants access only to the account whose owner has confirmed that address.

## User scenarios

- User registers → is signed in, gets an email with a confirmation link and sees a "Confirm your email" banner on every signed-in page.
- User opens the confirmation link → sees "Email confirmed". The banner disappears and meetings they are invited to appear on the dashboard without signing in again.
- User opens the confirmation link while signed out or in another browser → the email is still confirmed and the page offers to sign in.
- User opens a link that has expired, was already used or is malformed → sees an error naming the reason and, if signed in, a button to send a new link.
- User clicks "Send again" in the banner → gets a new email. Older links stop working. Clicking again within the cooldown shows how long to wait.
- Unverified user opens the dashboard → sees the meetings they own, but not the ones they are invited to.
- Unverified user opens a meeting they are invited to, or one of its recording links → gets "not found", as for any other meeting they can't see.
- Unverified user creates a meeting, uploads recordings, edits the profile or changes the password → everything works as for a verified user.
- Someone registers with the email of a person who is invited to a meeting but not yet registered → doesn't see that meeting or its recordings, because they can't open the confirmation link sent to that address.
- User who registered before this feature signs in → is treated as unverified, sees the banner and confirms the email the same way.
- Developer runs the app locally → sees the sent emails in a local mail inbox, with no real mail delivered.

## In scope

- Verification status on the user account. All existing accounts start unverified.
- A confirmation email sent on registration, with a single-use link that expires after 24 hours.
- Resending the confirmation email from the banner, with a 60-second cooldown per user. A new link invalidates the previous ones.
- A confirmation page in the web app for success, expired, already used and invalid links.
- A "Confirm your email" banner on every signed-in page until the email is confirmed, with the address it was sent to and a "Send again" button.
- Meeting access: owners always see their meetings. Invitations count only for users with a confirmed email. This applies to the meeting list, meeting details, recording lists and signed stream/download URLs issued after the change.
- Access changes take effect immediately after confirmation, with no new sign-in.
- The profile response exposes whether the email is confirmed.
- Mail delivery over SMTP, configured through environment variables. A local mail catcher in `docker-compose.yml` for development and e2e tests.
- An e2e test of the attack: an invitee's address registered by someone else gives no access to the meeting or its recordings until it's confirmed.
- Responsive layout of the banner and the confirmation page for desktop and mobile.

## Out of scope

- Changing the account email (email stays read-only).
- Password reset by email.
- Email notifications about invitations or recordings.
- Blocking sign-in or other features for unverified users.
- Revoking signed recording URLs that were issued before the change.
- Rate limiting of login and registration (a separate security task).
- HTML email templates beyond a plain message with the link.

## Criterion of readiness

- [ ] After registration, an email with a confirmation link arrives in the local mail catcher.
- [ ] Opening the link marks the email as confirmed; the profile response reports it as confirmed.
- [ ] A link older than 24 hours, an already used link, a link replaced by a resend and a malformed link are each rejected, and the page names the reason.
- [ ] Resending within 60 seconds is rejected with the remaining wait time; after that, a new email arrives.
- [ ] An unverified user doesn't see meetings they are invited to in the list, gets "not found" on their details and recordings, and can't get signed URLs for their recordings.
- [ ] The same user sees those meetings and recordings right after confirming, with the same access token.
- [ ] Owners see and manage their own meetings whether or not their email is confirmed.
- [ ] Existing users are unverified after the migration and can confirm through "Send again".
- [ ] The attack scenario is covered by an api e2e test: someone registers an invitee's address and gets no access to the meeting or its recordings.
- [ ] The banner shows on all signed-in pages for unverified users and disappears after confirmation without a reload of the whole app.
- [ ] The web e2e tests cover registration → confirmation link → banner gone → invited meeting visible.
- [ ] Banner and confirmation page are checked at desktop and mobile widths.
- [ ] Docs list the new SMTP env vars, the mail catcher and its port.
