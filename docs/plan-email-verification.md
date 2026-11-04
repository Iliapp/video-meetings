# Plan: Email verification

**PRD**: @docs/prd-email-verification.md
**Date:** 2026-10-27

## Implementation Phases

### Phase 1: Confirm email and gate invitations (tracer bullet, backend)

**Goal:** Registration sends a confirmation email to a local mail catcher, opening its token through the api confirms the email, and invitations grant access only to confirmed users. This closes the security hole (an invitee's address registered by someone else) end to end: database → mail → api → meeting access.
**Affects:** backend / database
**Tasks:**

- [ ] Write `apps/api/test/email-verification.e2e-spec.ts` and confirm it fails (red), reading sent mail through the Mailpit HTTP api: registration sends one email to the new address with a link containing a token; `POST /auth/verify-email` with that token → success, then `GET /users/me` returns `emailVerified: true`; an owner invites `invitee@…`, someone registers that address and without confirming gets no invited meeting in `GET /meetings`, `404` on `GET /meetings/:id` and on its recordings list (so no signed URLs); after confirming, the same access token sees the meeting and its recordings; the owner sees and manages their own meetings while unverified. Update existing e2e specs that rely on invitations to confirm the invitee first.
- [ ] Add a Mailpit service to `docker-compose.yml` (SMTP `1025`, web/api `8025`, started by `pnpm db:up`) and a mail module in `src/mail/` that sends plain-text email over SMTP (`SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `WEB_PUBLIC_URL` for links; defaults in `.env.example`, invalid values stop startup); point `test/setup-env.ts` at Mailpit.
- [ ] Add `emailVerifiedAt` (nullable, so every existing user starts unverified) to `User` and an `EmailVerificationToken` model (UUID id, user relation with a name and `@@index`, hash of the token, `expiresAt` 24 h, `usedAt`, `createdAt`/`updatedAt`, per `.claude/rules/prisma.md`); create the migration.
- [ ] On registration create a token and send the confirmation email (registration still succeeds if mail delivery fails, which is logged without the token); add `POST /auth/verify-email` (public, token in the body) that confirms the email; add `emailVerified` to the profile response; unit specs for the handlers.
- [ ] Make `visibleTo` count invitations only when the user's `emailVerifiedAt` is set, read from the database on each request, not from the JWT; unit specs; update `CLAUDE.md`, `apps/api/CLAUDE.md` (mail module, env vars, access rule) and the root Local database section (Mailpit, ports).

**Done criteria:** `email-verification.e2e-spec.ts` is green, including the attack scenario; all earlier api unit and e2e tests still pass; `pnpm lint`, `pnpm typecheck` and `pnpm build` pass for the api.

### Phase 2: Link rules and resend (backend)

**Goal:** Confirmation links are single-use and expire after 24 hours, every rejection names its reason, and a signed-in user can request a new link at most once per 60 seconds, which invalidates the older ones.
**Affects:** backend
**Tasks:**

- [ ] Extend `email-verification.e2e-spec.ts` and confirm the new cases fail (red): a used token, an expired token (short TTL in the test), a token replaced by a resend and a malformed token are each rejected with a distinct reason; `POST /auth/resend-verification` without a token → `401`; within 60 s of the last email → `429` with the remaining seconds; after that a new email arrives and only its link works; a confirmed user's resend is rejected; a user created without `emailVerifiedAt` (as after the migration) can confirm through resend.
- [ ] Mark tokens used on confirmation and return a reason code (`EXPIRED`, `USED`, `INVALID`) for rejected tokens, as an enum.
- [ ] Add `ResendVerificationCommand` and `POST /auth/resend-verification` behind `JwtAuthGuard`: enforce the cooldown from the latest token's `createdAt`, invalidate the user's open tokens, send a new email; make the TTL and cooldown constants (TTL overridable by env for tests); unit specs.
- [ ] Update `apps/api/CLAUDE.md` (resend route, cooldown, TTL env var).

**Done criteria:** the extended `email-verification.e2e-spec.ts` is green; all phase 1 and earlier api tests still pass; `pnpm lint`, `pnpm typecheck` and `pnpm build` pass for the api.

### Phase 3: Confirmation page and banner (frontend)

**Goal:** In the web app, the confirmation link from the email confirms the address, an unverified user sees a "Confirm your email" banner on every signed-in page, and after confirming the banner disappears and invited meetings appear.
**Affects:** frontend
**Tasks:**

- [ ] Write `apps/web/e2e/email-verification.spec.ts` and confirm it fails (red), reading the link from Mailpit: register → banner with the email on dashboard, meeting and profile pages; an owner's invited meeting isn't on the invitee's dashboard; open the link → "Email confirmed", banner gone without a full reload, invited meeting visible; opening the link signed out confirms it and offers to sign in; keyboard-only flow; no horizontal scroll at 375, 1440 and 1920 px. Point the web e2e api (`:4100`) at Mailpit.
- [ ] Add `verifyEmail` to `src/lib/api/` and `emailVerified` to the shared profile state.
- [ ] Add `src/app/verify-email/` that reads the token from the URL, confirms it and shows success with a link to the dashboard or sign-in.
- [ ] Add the banner (HeroUI) to the signed-in layout, shown while `emailVerified` is false, refreshed after confirmation.
- [ ] Test in the running app with the Playwright MCP and review with `ui-ux-pro-max`; update `apps/web/CLAUDE.md` (route, banner, Mailpit in e2e).

**Done criteria:** `email-verification.spec.ts` is green; `profile.spec.ts`, `meeting-recordings.spec.ts` and all api tests still pass; screenshots at 375, 1440 and 1920 px taken and reviewed; `pnpm lint` and `pnpm typecheck` pass.

### Phase 4: Resend and link errors (frontend)

**Goal:** The user sees why a link was rejected (expired, already used, invalid) and can request a new email from the banner or the error page, with the cooldown shown.
**Affects:** frontend
**Tasks:**

- [ ] Extend `apps/web/e2e/email-verification.spec.ts` and confirm the new cases fail (red): expired, used and malformed links each show their own message; signed in, the error page and the banner offer "Send again"; clicking it sends a new email whose link works; clicking again within 60 s shows the wait time; signed out, the error page offers sign-in instead; layout at 375, 1440 and 1920 px.
- [ ] Add `resendVerification` to `src/lib/api/`, mapping `429` to the remaining wait time.
- [ ] Add the error states to `src/app/verify-email/` and the "Send again" button with success and cooldown messages to the page and the banner.
- [ ] Test in the running app with the Playwright MCP and review with `ui-ux-pro-max`; update `apps/web/CLAUDE.md` if anything new needs mentioning.

**Done criteria:** the extended `email-verification.spec.ts` is green; all phase 3 and earlier web and api tests still pass; screenshots at 375, 1440 and 1920 px taken and reviewed; `pnpm lint` and `pnpm typecheck` pass.
