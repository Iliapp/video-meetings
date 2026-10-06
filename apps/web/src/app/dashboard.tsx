'use client';

import {
  ArrowRightFromSquare,
  ArrowRotateRight,
  Calendar,
  Clock,
  Person,
  Persons,
  Plus,
} from '@gravity-ui/icons';
import { Alert, Button, Card, Chip, Skeleton } from '@heroui/react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react';
import { Logo } from '@/components/logo';
import { ApiError, listMeetings, type Meeting } from '@/lib/api';
import {
  clearAccessToken,
  getAccessToken,
  readSession,
  subscribeToAccessToken,
} from '@/lib/auth-token';
import { CreateMeetingModal } from './create-meeting-modal';

const RECENT_LIMIT = 5;

type MeetingsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  // `loadedAt` is "now" for upcoming/past, captured outside render.
  | { status: 'ready'; meetings: Meeting[]; loadedAt: number };

const dayFormat = new Intl.DateTimeFormat('en', { day: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function Dashboard() {
  const router = useRouter();
  // `undefined` until hydrated: the server can't see localStorage.
  const token = useSyncExternalStore(
    subscribeToAccessToken,
    getAccessToken,
    () => undefined,
  );
  const session = useMemo(
    () => (token === undefined ? undefined : token && readSession(token)),
    [token],
  );
  const [state, setState] = useState<MeetingsState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const signOut = useCallback(() => {
    clearAccessToken();
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      signOut();
      return;
    }

    let ignore = false;
    listMeetings(session.token).then(
      (meetings) => {
        if (!ignore) {
          setState({ status: 'ready', meetings, loadedAt: Date.now() });
        }
      },
      (e: unknown) => {
        if (ignore) return;
        if (e instanceof ApiError && e.status === 401) {
          signOut();
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
  }, [session, signOut, reloadKey]);

  if (!session) return <DashboardSkeleton />;

  const meetings = state.status === 'ready' ? state.meetings : [];
  const now = state.status === 'ready' ? state.loadedAt : 0;
  const upcoming = meetings.filter((m) => new Date(m.date).getTime() > now);
  const hosted = meetings.filter((m) => m.ownerId === session.userId);
  // Soonest upcoming first, then the most recent past ones.
  const past = meetings
    .filter((m) => new Date(m.date).getTime() <= now)
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const recent = [
    ...upcoming.toSorted((a, b) => a.date.localeCompare(b.date)),
    ...past,
  ].slice(0, RECENT_LIMIT);

  const stats = [
    { label: 'Total meetings', value: meetings.length, icon: Calendar },
    { label: 'Upcoming', value: upcoming.length, icon: Clock },
    { label: 'Hosted by you', value: hosted.length, icon: Person },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-separator">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <Button className="h-11" variant="secondary" onPress={signOut}>
            <ArrowRightFromSquare aria-hidden className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-muted">Welcome back,</p>
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-3xl">
              {session.email}
            </h1>
          </div>
          <Button
            className="h-12 shrink-0 rounded-xl max-sm:w-full"
            size="lg"
            variant="primary"
            onPress={() => setIsCreateOpen(true)}
          >
            <Plus aria-hidden className="size-4" />
            New meeting
          </Button>
        </section>

        {state.status === 'error' ? (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Couldn&apos;t load your meetings</Alert.Title>
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
        ) : (
          <>
            <section aria-label="Meeting stats">
              <ul className="grid grid-cols-3 gap-3 sm:gap-4">
                {stats.map(({ label, value, icon }) => (
                  <li key={label}>
                    <StatCard
                      label={label}
                      value={state.status === 'ready' ? value : null}
                      icon={icon}
                    />
                  </li>
                ))}
              </ul>
            </section>

            <Card className="gap-0 p-0">
              <Card.Header className="border-b border-separator px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold">Recent meetings</h2>
                <Card.Description>
                  Your next meetings first, then the most recent ones.
                </Card.Description>
              </Card.Header>
              <Card.Content className="p-0">
                {state.status === 'loading' ? (
                  <MeetingListSkeleton />
                ) : recent.length ? (
                  <ul className="divide-y divide-separator">
                    {recent.map((meeting) => (
                      <MeetingRow
                        key={meeting.id}
                        meeting={meeting}
                        isHost={meeting.ownerId === session.userId}
                        isUpcoming={new Date(meeting.date).getTime() > now}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState onCreate={() => setIsCreateOpen(true)} />
                )}
              </Card.Content>
            </Card>
          </>
        )}
      </main>

      <CreateMeetingModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        token={session.token}
        onCreated={(meeting) => {
          if (state.status === 'ready') {
            setState({
              status: 'ready',
              meetings: [...state.meetings, meeting],
              loadedAt: Date.now(),
            });
          } else {
            // The list isn't loaded, so fetch it again with the new meeting.
            setState({ status: 'loading' });
            setReloadKey((key) => key + 1);
          }
        }}
        onUnauthorized={signOut}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | null;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}) {
  return (
    <Card className="h-full flex-row items-stretch gap-4 p-4 sm:items-center sm:p-5">
      <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground sm:flex">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col justify-between gap-1">
        <p className="text-xs text-muted sm:text-sm">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-8 w-12 rounded-md" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
            {value}
          </p>
        )}
      </div>
    </Card>
  );
}

function MeetingRow({
  meeting,
  isHost,
  isUpcoming,
}: {
  meeting: Meeting;
  isHost: boolean;
  isUpcoming: boolean;
}) {
  const date = new Date(meeting.date);
  // The owner isn't listed in `participants`.
  const people = meeting.participants.length + 1;

  return (
    <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <div
        aria-hidden
        className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-default leading-none"
      >
        <span className="text-xs text-muted uppercase">
          {monthFormat.format(date)}
        </span>
        <span className="text-lg font-semibold">{dayFormat.format(date)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-medium">{meeting.title}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <time dateTime={meeting.date}>{dateTimeFormat.format(date)}</time>
          <span className="flex items-center gap-1">
            <Persons aria-hidden className="size-3.5" />
            {people} {people === 1 ? 'person' : 'people'}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        {isHost && (
          <Chip size="sm" variant="soft" color="accent">
            Host
          </Chip>
        )}
        <Chip
          size="sm"
          variant="soft"
          color={isUpcoming ? 'success' : 'default'}
        >
          {isUpcoming ? 'Upcoming' : 'Past'}
        </Chip>
      </div>
    </li>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <Calendar aria-hidden className="size-6" />
      </span>
      <p className="font-medium">No meetings yet</p>
      <p className="max-w-sm text-sm text-pretty text-muted">
        Create your first meeting and invite your team by email.
      </p>
      <Button className="mt-2 h-11" variant="secondary" onPress={onCreate}>
        <Plus aria-hidden className="size-4" />
        New meeting
      </Button>
    </div>
  );
}

function MeetingListSkeleton() {
  return (
    <ul aria-busy className="divide-y divide-separator">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy className="flex flex-1 flex-col">
      <div className="h-16 border-b border-separator" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
        <Skeleton className="h-16 w-72 max-w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}
