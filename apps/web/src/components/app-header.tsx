'use client';

import { ArrowRightFromSquare } from '@gravity-ui/icons';
import { Button, Skeleton } from '@heroui/react';
import NextLink from 'next/link';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api';
import type { Session } from '@/lib/auth-token';
import { useProfile } from '@/lib/use-profile';
import { Logo } from './logo';
import { UserAvatar } from './user-avatar';

// Top bar of signed-in pages: the logo links home, the user's avatar and name
// (or email) link to /profile, plus a sign-out button.
export function AppHeader({
  session,
  onSignOut,
}: {
  session: Session;
  onSignOut: () => void;
}) {
  const { state } = useProfile(session.token);
  const unauthorized =
    state.status === 'error' &&
    state.error instanceof ApiError &&
    state.error.status === 401;

  useEffect(() => {
    if (unauthorized) onSignOut();
  }, [unauthorized, onSignOut]);

  return (
    <header className="border-b border-separator">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <NextLink
          href="/"
          className="shrink-0 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Logo />
        </NextLink>
        <div className="flex min-w-0 items-center gap-2">
          {state.status === 'loading' ? (
            <div
              role="status"
              aria-label="Loading profile"
              className="flex h-11 items-center gap-2 px-1"
            >
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="hidden h-4 w-32 rounded-md sm:block" />
            </div>
          ) : (
            // A failed load still shows who is signed in, from the token.
            <ProfileLink
              {...(state.status === 'ready'
                ? state.profile
                : { name: null, email: session.email, avatarUrl: null })}
            />
          )}
          <Button
            className="h-11 shrink-0"
            variant="secondary"
            onPress={onSignOut}
          >
            <ArrowRightFromSquare aria-hidden className="size-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

function ProfileLink({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const label = name ?? email;
  return (
    <NextLink
      href="/profile"
      title={label}
      className="flex h-11 min-w-0 items-center gap-2 rounded-full px-1 text-sm font-medium transition-colors outline-offset-2 hover:bg-default focus-visible:outline-2 focus-visible:outline-accent sm:pr-3"
    >
      <UserAvatar
        name={name}
        email={email}
        avatarUrl={avatarUrl}
        className="shrink-0"
      />
      {/* Only the avatar shows on small screens; the text still names the link. */}
      <span className="max-sm:sr-only sm:max-w-48 sm:truncate">{label}</span>
    </NextLink>
  );
}
