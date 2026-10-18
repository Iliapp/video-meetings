'use client';

import { ArrowRotateRight, ArrowUpFromLine, Video } from '@gravity-ui/icons';
import { Alert, Button, Card, CloseButton, Skeleton } from '@heroui/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  getRecordingUrls,
  listRecordings,
  type Recording,
} from '@/lib/api';
import { FORMATS_HINT } from '@/lib/recordings';
import { RecordingPlayer } from './recording-player';
import { RecordingRow } from './recording-row';
import {
  RecordingDropZone,
  UploadButton,
  UploadStatus,
  useRecordingUpload,
} from './recording-upload';

type RecordingsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recordings: Recording[] };

interface Notice {
  status: 'warning' | 'danger';
  title: string;
  description: string;
}

const CONNECTION_ERROR = 'Failed to connect to the server.';
const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : CONNECTION_ERROR;

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

  const isListReady = state.status === 'ready';
  const onUploaded = useCallback(
    (recording: Recording) => {
      if (isListReady) {
        setState((s) =>
          s.status === 'ready'
            ? { status: 'ready', recordings: [recording, ...s.recordings] }
            : s,
        );
      } else {
        // The list is loading or failed: load it again, so the new recording
        // isn't lost or overwritten by an older response.
        setState({ status: 'loading' });
        setReloadKey((key) => key + 1);
      }
    },
    [isListReady],
  );
  const upload = useRecordingUpload({
    token,
    meetingId,
    onUploaded,
    onUnauthorized,
  });
  const isUploading = upload.state.status === 'uploading';

  const recordings = state.status === 'ready' ? state.recordings : [];

  const [player, setPlayer] = useState<{
    recordingId: string;
    streamUrl: string;
  } | null>(null);
  const [pending, setPending] = useState<{
    recordingId: string;
    action: 'play' | 'download';
  } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Only the latest Play/Download press acts on its response.
  const actionId = useRef(0);

  /** Signed URLs, or `null` after handling a `401`. Throws other errors. */
  const fetchUrls = useCallback(
    async (recording: Recording) => {
      try {
        return await getRecordingUrls(token, meetingId, recording.id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          onUnauthorized();
          return null;
        }
        throw e;
      }
    },
    [token, meetingId, onUnauthorized],
  );

  const runAction = async (
    recording: Recording,
    action: 'play' | 'download',
  ) => {
    const id = ++actionId.current;
    setPending({ recordingId: recording.id, action });
    setNotice(null);
    try {
      const urls = await fetchUrls(recording);
      if (id !== actionId.current || !urls) return;
      if (action === 'play') {
        setPlayer({ recordingId: recording.id, streamUrl: urls.streamUrl });
      } else {
        // Content-Disposition: attachment, so the page stays.
        const link = document.createElement('a');
        link.href = urls.downloadUrl;
        link.rel = 'noopener';
        link.click();
      }
    } catch (e) {
      if (id !== actionId.current) return;
      setNotice({
        status: 'danger',
        title: `Couldn't ${action} ${recording.originalName}`,
        description: errorText(e),
      });
    } finally {
      if (id === actionId.current) setPending(null);
    }
  };

  const refreshStreamUrl = async (recording: Recording) => {
    const urls = await fetchUrls(recording);
    return urls?.streamUrl ?? null;
  };

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
    content = isOwner ? (
      <div className="p-5 sm:p-6">
        <RecordingDropZone onFile={upload.start} isDisabled={isUploading}>
          <EmptyState isOwner />
        </RecordingDropZone>
      </div>
    ) : (
      <EmptyState isOwner={false} />
    );
  } else {
    content = (
      <>
        {/* Touch screens can't drag files in; they use the button. */}
        {isOwner && (
          <div className="px-5 pt-5 max-sm:hidden sm:px-6">
            <RecordingDropZone
              onFile={upload.start}
              isDisabled={isUploading}
              className="flex min-h-14 items-center justify-center gap-2 px-4 py-3 text-center text-sm text-muted"
            >
              <ArrowUpFromLine aria-hidden className="size-4 shrink-0" />
              <span>
                Drag and drop a recording here{' '}
                <span className="max-sm:hidden">· {FORMATS_HINT}</span>
              </span>
            </RecordingDropZone>
          </div>
        )}
        <ul aria-label="Recordings" className="divide-y divide-separator">
          {recordings.map((recording) => (
            <RecordingRow
              key={recording.id}
              recording={recording}
              isPlayerOpen={player?.recordingId === recording.id}
              pendingAction={
                pending?.recordingId === recording.id ? pending.action : null
              }
              onPlay={() => void runAction(recording, 'play')}
              onClosePlayer={() => setPlayer(null)}
              onDownload={() => void runAction(recording, 'download')}
              player={
                player?.recordingId === recording.id && (
                  <RecordingPlayer
                    recording={recording}
                    streamUrl={player.streamUrl}
                    refreshUrl={() => refreshStreamUrl(recording)}
                  />
                )
              }
            />
          ))}
        </ul>
      </>
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
        {isOwner && (
          <UploadButton onFile={upload.start} isDisabled={isUploading} />
        )}
      </Card.Header>
      {isOwner && upload.state.status !== 'idle' && (
        <div className="border-b border-separator px-5 py-4 sm:px-6">
          <UploadStatus
            state={upload.state}
            onCancel={upload.cancel}
            onRetry={upload.retry}
            onDismiss={upload.dismiss}
          />
        </div>
      )}
      {notice && (
        <div className="border-b border-separator px-5 py-4 sm:px-6">
          <Alert role="alert" status={notice.status}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{notice.title}</Alert.Title>
              <Alert.Description>{notice.description}</Alert.Description>
            </Alert.Content>
            <CloseButton
              aria-label="Dismiss"
              className="size-11"
              onPress={() => setNotice(null)}
            />
          </Alert>
        </div>
      )}
      <Card.Content className="p-0">{content}</Card.Content>
    </Card>
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
          ? 'Use Upload recording, or drag and drop a video or audio file here. Participants will see it in this list.'
          : 'The host hasn’t uploaded any recordings of this meeting yet.'}
      </p>
      {isOwner && <p className="text-xs text-muted">{FORMATS_HINT}</p>}
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
