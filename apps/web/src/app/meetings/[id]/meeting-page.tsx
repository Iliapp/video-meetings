'use client';

import {
  ArrowLeft,
  ArrowRotateRight,
  Calendar,
  CircleQuestion,
  Person,
} from '@gravity-ui/icons';
import { Alert, Button, Card, Chip, Skeleton } from '@heroui/react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ApiError, getMeeting, type Meeting } from '@/lib/api';
import type { Session } from '@/lib/auth-token';
import { useSession } from '@/lib/use-session';
import { RecordingsSection } from './recordings-section';

type MeetingState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; meeting: Meeting; loadedAt: number };

const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'full',
  timeStyle: 'short',
});

export function MeetingPage({ id }: { id: string }) {
  const { session, signOut } = useSession();
  const [state, setState] = useState<MeetingState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      signOut();
      return;
    }

    let ignore = false;
    getMeeting(session.token, id).then(
      (meeting) => {
        if (!ignore) {
          setState({ status: 'ready', meeting, loadedAt: Date.now() });
        }
      },
      (e: unknown) => {
        if (ignore) return;
        if (e instanceof ApiError && e.status === 401) {
          signOut();
        } else if (e instanceof ApiError && e.status === 404) {
          setState({ status: 'not-found' });
        } else {
          setState({
            status: 'error',
            message:
              e instanceof ApiError
                ? e.message
                : 'Failed to connect to the server.',
          });
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [session, signOut, id, reloadKey]);

  if (!session) return <PageSkeleton />;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader onSignOut={signOut} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <NextLink
          href="/"
          className="-ml-2 inline-flex h-11 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All meetings
        </NextLink>

        {state.status === 'loading' && <MeetingSkeleton />}
        {state.status === 'not-found' && <NotFound />}
        {state.status === 'error' && (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Couldn&apos;t load this meeting</Alert.Title>
              <Alert.Description>{state.message}</Alert.Description>
              <Button
                className="mt-3 h-11"
                size="sm"
                variant="secondary"
                onPress={() => {
                  setState({ status: 'loading' });
                  setReloadKey((key) => key + 1);
                }}
              >
                <ArrowRotateRight aria-hidden className="size-4" />
                Try again
              </Button>
            </Alert.Content>
          </Alert>
        )}
        {state.status === 'ready' && (
          <MeetingDetails
            meeting={state.meeting}
            session={session}
            now={state.loadedAt}
            onUnauthorized={signOut}
          />
        )}
      </main>
    </div>
  );
}

function MeetingDetails({
  meeting,
  session,
  now,
  onUnauthorized,
}: {
  meeting: Meeting;
  session: Session;
  now: number;
  onUnauthorized: () => void;
}) {
  const isOwner = meeting.ownerId === session.userId;
  const date = new Date(meeting.date);
  const isUpcoming = date.getTime() > now;

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip size="sm" variant="soft" color={isOwner ? 'accent' : 'default'}>
            {isOwner ? 'Host' : 'Invited'}
          </Chip>
          <Chip
            size="sm"
            variant="soft"
            color={isUpcoming ? 'success' : 'default'}
          >
            {isUpcoming ? 'Upcoming' : 'Past'}
          </Chip>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance break-words sm:text-3xl">
          {meeting.title}
        </h1>
        <p className="flex items-center gap-2 text-muted">
          <Calendar aria-hidden className="size-4 shrink-0" />
          <time dateTime={meeting.date}>{dateFormat.format(date)}</time>
        </p>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <RecordingsSection
          meetingId={meeting.id}
          token={session.token}
          isOwner={isOwner}
          onUnauthorized={onUnauthorized}
        />
        <Participants meeting={meeting} session={session} isOwner={isOwner} />
      </div>
    </>
  );
}

function Participants({
  meeting,
  session,
  isOwner,
}: {
  meeting: Meeting;
  session: Session;
  isOwner: boolean;
}) {
  // The api lists invitees only; the host's email is known when it's you.
  const people = [
    { key: 'host', email: isOwner ? session.email : null, isHost: true },
    ...meeting.participants.map((email) => ({
      key: email,
      email,
      isHost: false,
    })),
  ];

  return (
    <Card className="min-w-0 gap-0 p-0">
      <Card.Header className="border-b border-separator px-5 py-4">
        <h2 id="participants-heading" className="text-lg font-semibold">
          Participants
        </h2>
        <Card.Description>
          {people.length} {people.length === 1 ? 'person' : 'people'}
        </Card.Description>
      </Card.Header>
      <Card.Content className="p-0">
        <ul aria-label="Participants" className="divide-y divide-separator">
          {people.map(({ key, email, isHost }) => (
            <li key={key} className="flex items-center gap-3 px-5 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-default text-muted">
                {email ? (
                  <Person aria-hidden className="size-4" />
                ) : (
                  <CircleQuestion aria-hidden className="size-4" />
                )}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-sm"
                title={email ?? undefined}
              >
                {email ?? 'Meeting host'}
                {email === session.email && (
                  <span className="text-muted"> (you)</span>
                )}
              </span>
              {isHost && (
                <Chip size="sm" variant="soft" color="accent">
                  Host
                </Chip>
              )}
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-separator px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-default text-muted">
        <CircleQuestion aria-hidden className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">Meeting not found</h1>
      <p className="max-w-sm text-sm text-pretty text-muted">
        It may have been deleted, or you aren&apos;t invited to it.
      </p>
      <NextLink
        href="/"
        className="mt-2 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to your meetings
      </NextLink>
    </div>
  );
}

function MeetingSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-9 w-2/3 rounded-lg" />
        <Skeleton className="h-5 w-64 max-w-full rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy className="flex flex-1 flex-col">
      <div className="h-16 border-b border-separator" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <MeetingSkeleton />
      </div>
    </div>
  );
}
