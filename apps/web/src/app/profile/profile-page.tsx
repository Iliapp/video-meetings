'use client';

import { ArrowLeft, ArrowRotateRight } from '@gravity-ui/icons';
import { Alert, Button, Card, Skeleton } from '@heroui/react';
import NextLink from 'next/link';
import { useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { ApiError } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { useSession } from '@/lib/use-session';
import { NameForm } from './name-form';

export function ProfilePage() {
  const { session, signOut } = useSession();
  const { state, reload, saveName } = useProfile(session?.token);

  useEffect(() => {
    if (session === null) signOut();
  }, [session, signOut]);

  if (!session) return <PageSkeleton />;

  return (
    <div className="flex flex-1 flex-col">
      {/* The header signs out when the profile answers 401. */}
      <AppHeader session={session} onSignOut={signOut} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <NextLink
          href="/"
          className="-ml-2 inline-flex h-11 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All meetings
        </NextLink>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Profile
          </h1>
          <p className="text-muted">How you appear to others in meetings.</p>
        </div>

        {state.status === 'loading' && <FormSkeleton />}
        {state.status === 'error' && (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Couldn&apos;t load your profile</Alert.Title>
              <Alert.Description>
                {state.error instanceof ApiError
                  ? state.error.message
                  : 'Failed to connect to the server.'}
              </Alert.Description>
              <Button
                className="mt-3 h-11"
                size="sm"
                variant="secondary"
                onPress={reload}
              >
                <ArrowRotateRight aria-hidden className="size-4" />
                Try again
              </Button>
            </Alert.Content>
          </Alert>
        )}
        {state.status === 'ready' && (
          <Card className="min-w-0 p-5 sm:p-6">
            <NameForm
              profile={state.profile}
              saveName={saveName}
              onUnauthorized={signOut}
            />
          </Card>
        )}
      </main>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div
      aria-busy
      aria-label="Loading your profile"
      className="flex flex-col gap-6 rounded-3xl border border-separator p-5 sm:p-6"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <Skeleton className="h-5 w-48 max-w-full rounded-md" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-11 w-24 rounded-xl" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy className="flex flex-1 flex-col">
      <div className="h-16 border-b border-separator" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <FormSkeleton />
      </div>
    </div>
  );
}
