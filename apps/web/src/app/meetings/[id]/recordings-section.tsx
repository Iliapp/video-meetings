'use client';

import {
  ArrowRotateRight,
  Clock,
  Headphones,
  HardDrive,
  Video,
} from '@gravity-ui/icons';
import { Alert, Button, Card, Chip, Skeleton } from '@heroui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, listRecordings, type Recording } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/recordings';

type RecordingsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recordings: Recording[] };

const uploadedFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function RecordingsSection({
  meetingId,
  token,
  isOwner,
  onUnauthorized,
}: {
  meetingId: string;
  token: string;
  isOwner: boolean;
  onUnauthorized: () => void;
}) {
  const [state, setState] = useState<RecordingsState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    listRecordings(token, meetingId).then(
      (recordings) => {
        if (!ignore) setState({ status: 'ready', recordings });
      },
      (e: unknown) => {
        if (ignore) return;
        if (e instanceof ApiError && e.status === 401) {
          onUnauthorized();
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
  }, [token, meetingId, onUnauthorized, reloadKey]);

  const recordings = state.status === 'ready' ? state.recordings : [];

  let content: ReactNode;
  if (state.status === 'loading') {
    content = <RecordingListSkeleton />;
  } else if (state.status === 'error') {
    content = (
      <div className="p-5 sm:p-6">
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn&apos;t load recordings</Alert.Title>
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
      </div>
    );
  } else if (recordings.length === 0) {
    content = <EmptyState isOwner={isOwner} />;
  } else {
    content = (
      <ul aria-label="Recordings" className="divide-y divide-separator">
        {recordings.map((recording) => (
          <RecordingRow key={recording.id} recording={recording} />
        ))}
      </ul>
    );
  }

  return (
    <Card className="min-w-0 gap-0 p-0">
      <Card.Header className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-separator px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold">Recordings</h2>
          <Card.Description>
            {state.status === 'ready'
              ? `${recordings.length} ${recordings.length === 1 ? 'recording' : 'recordings'}`
              : 'Video and audio from this meeting'}
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Content className="p-0">{content}</Card.Content>
    </Card>
  );
}

function RecordingRow({ recording }: { recording: Recording }) {
  const isVideo = recording.kind === 'video';
  const Icon = isVideo ? Video : Headphones;

  return (
    <li className="flex items-start gap-4 px-5 py-4 sm:px-6">
      <span
        aria-hidden
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
          isVideo
            ? 'bg-accent-soft text-accent-soft-foreground'
            : 'bg-default text-foreground'
        }`}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-medium" title={recording.originalName}>
            {recording.originalName}
          </p>
          <Chip
            size="sm"
            variant="soft"
            color={isVideo ? 'accent' : 'default'}
            className="shrink-0"
          >
            {isVideo ? 'Video' : 'Audio'}
          </Chip>
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <HardDrive aria-hidden className="size-3.5" />
            <span className="sr-only">Size </span>
            {formatBytes(recording.sizeBytes)}
          </span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <Clock aria-hidden className="size-3.5" />
            <span className="sr-only">Duration </span>
            {recording.durationSeconds === null ? (
              <span title="Duration unknown">
                {formatDuration(null)}
                <span className="sr-only"> (unknown)</span>
              </span>
            ) : (
              formatDuration(recording.durationSeconds)
            )}
          </span>
        </p>
        <p className="text-sm break-words text-muted">
          Uploaded{' '}
          <time dateTime={recording.createdAt}>
            {uploadedFormat.format(new Date(recording.createdAt))}
          </time>{' '}
          by <span className="break-all">{recording.uploaderEmail}</span>
        </p>
      </div>
    </li>
  );
}

function EmptyState({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <Video aria-hidden className="size-6" />
      </span>
      <p className="font-medium">No recordings yet</p>
      <p className="max-w-sm text-sm text-pretty text-muted">
        {isOwner
          ? 'Upload a video or audio recording of this meeting to share it with participants.'
          : 'The host hasn’t uploaded any recordings of this meeting yet.'}
      </p>
    </div>
  );
}

function RecordingListSkeleton() {
  return (
    <ul aria-busy className="divide-y divide-separator">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex items-start gap-4 px-5 py-4 sm:px-6">
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
            <Skeleton className="h-3 w-2/3 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}
