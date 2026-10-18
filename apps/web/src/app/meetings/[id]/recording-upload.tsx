'use client';

import { ArrowRotateRight, ArrowUpFromLine, Xmark } from '@gravity-ui/icons';
import { Alert, AlertDialog, Button, Label, ProgressBar } from '@heroui/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DropZone,
  FileTrigger,
  type DropItem,
  type FileDropItem,
} from 'react-aria-components';
import {
  ApiError,
  UPLOAD_FAILED_MESSAGE,
  uploadRecording,
  type Recording,
} from '@/lib/api';
import {
  ACCEPTED_FILE_TYPES,
  readMediaDuration,
  validateRecordingFile,
} from '@/lib/recordings';

export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string; progress: number }
  // `retryFile` is set when the same file may succeed on a second try
  // (network or server failure), not for format or size problems.
  | { status: 'error'; message: string; retryFile?: File };

const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError';

/** One upload at a time: validate, read the duration, send with progress. */
export function useRecordingUpload({
  token,
  meetingId,
  onUploaded,
  onUnauthorized,
}: {
  token: string;
  meetingId: string;
  onUploaded: (recording: Recording) => void;
  onUnauthorized: () => void;
}) {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  // Leaving the page cancels the request instead of leaking it.
  useEffect(() => () => controllerRef.current?.abort(), []);

  // Ask before closing the tab mid-upload.
  useEffect(() => {
    if (state.status !== 'uploading') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.status]);

  const start = useCallback(
    async (file: File) => {
      if (controllerRef.current) return;
      const problem = validateRecordingFile(file);
      if (problem) {
        setState({ status: 'error', message: problem });
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: 'uploading', fileName: file.name, progress: 0 });
      try {
        const durationSeconds = await readMediaDuration(file, {
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        const recording = await uploadRecording(
          token,
          meetingId,
          file,
          durationSeconds,
          {
            signal: controller.signal,
            onProgress: (progress) =>
              setState((s) =>
                s.status === 'uploading' ? { ...s, progress } : s,
              ),
          },
        );
        setState({ status: 'idle' });
        onUploaded(recording);
      } catch (e) {
        if (isAbort(e)) {
          setState({ status: 'idle' });
        } else if (e instanceof ApiError && e.status === 401) {
          onUnauthorized();
        } else {
          const retryable =
            !(e instanceof ApiError) || e.status === 0 || e.status >= 500;
          setState({
            status: 'error',
            message:
              e instanceof ApiError && e.status !== 0
                ? e.message
                : UPLOAD_FAILED_MESSAGE,
            retryFile: retryable ? file : undefined,
          });
        }
      } finally {
        controllerRef.current = null;
      }
    },
    [token, meetingId, onUploaded, onUnauthorized],
  );

  const retryFile = state.status === 'error' ? state.retryFile : undefined;
  // Stable callbacks, so progress updates don't re-render the picker and
  // drop zones with new props.
  const actions = useMemo(
    () => ({
      start: (file: File) => void start(file),
      cancel: () => controllerRef.current?.abort(),
      retry: () => {
        if (retryFile) void start(retryFile);
      },
      dismiss: () => setState({ status: 'idle' }),
    }),
    [start, retryFile],
  );

  return { state, ...actions };
}

export function UploadButton({
  onFile,
  isDisabled,
}: {
  onFile: (file: File) => void;
  isDisabled: boolean;
}) {
  return (
    <FileTrigger
      acceptedFileTypes={ACCEPTED_FILE_TYPES}
      onSelect={(files) => {
        const file = files?.[0];
        if (file) onFile(file);
      }}
    >
      <Button
        className="h-11 max-sm:w-full"
        variant="primary"
        isDisabled={isDisabled}
      >
        <ArrowUpFromLine aria-hidden className="size-4" />
        Upload recording
      </Button>
    </FileTrigger>
  );
}

// Drag-and-drop target. The Upload recording button is the keyboard and
// single-pointer alternative, so dragging is never the only way to upload.
export function RecordingDropZone({
  onFile,
  isDisabled,
  className = '',
  children,
}: {
  onFile: (file: File) => void;
  isDisabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  const onDrop = async (items: DropItem[]) => {
    const item = items.find((i): i is FileDropItem => i.kind === 'file');
    if (item) onFile(await item.getFile());
  };

  return (
    <DropZone
      data-testid="recording-dropzone"
      aria-label="Drop a recording to upload"
      isDisabled={isDisabled}
      onDrop={(e) => void onDrop(e.items)}
      className={`rounded-2xl border-2 border-dashed border-separator transition-colors outline-none data-[drop-target]:border-accent data-[drop-target]:bg-accent-soft data-[focus-visible]:border-accent ${className}`}
    >
      {children}
    </DropZone>
  );
}

export function UploadStatus({
  state,
  onCancel,
  onRetry,
  onDismiss,
}: {
  state: UploadState;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (state.status === 'uploading') {
    return <UploadProgress state={state} onCancel={onCancel} />;
  }

  if (state.status === 'error') {
    return (
      <Alert role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Couldn&apos;t upload the recording</Alert.Title>
          <Alert.Description>{state.message}</Alert.Description>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.retryFile && (
              <Button
                className="h-11"
                size="sm"
                variant="secondary"
                onPress={onRetry}
              >
                <ArrowRotateRight aria-hidden className="size-4" />
                Retry
              </Button>
            )}
            <Button
              className="h-11"
              size="sm"
              variant="tertiary"
              onPress={onDismiss}
            >
              Dismiss
            </Button>
          </div>
        </Alert.Content>
      </Alert>
    );
  }

  return null;
}

function UploadProgress({
  state,
  onCancel,
}: {
  state: Extract<UploadState, { status: 'uploading' }>;
  onCancel: () => void;
}) {
  // The upload keeps going while the dialog is open; it unmounts with this
  // component when the upload finishes.
  const [isConfirming, setIsConfirming] = useState(false);
  const isProcessing = state.progress >= 1;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <ProgressBar
        className="min-w-0 flex-1"
        value={state.progress * 100}
        // The bytes are sent; the api is checking and saving the file.
        valueLabel={isProcessing ? 'Processing…' : undefined}
      >
        <Label className="truncate">Uploading {state.fileName}</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <Button
        className="h-11 shrink-0"
        variant="secondary"
        // Once every byte is sent the api saves the file anyway, so
        // cancelling would no longer keep it out of the list.
        isDisabled={isProcessing}
        onPress={() => setIsConfirming(true)}
      >
        <Xmark aria-hidden className="size-4" />
        Cancel upload
      </Button>
      <AlertDialog.Backdrop
        isOpen={isConfirming && !isProcessing}
        onOpenChange={setIsConfirming}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[440px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>Cancel upload?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                <strong className="break-all">{state.fileName}</strong>{' '}
                hasn&apos;t finished uploading. If you cancel, it won&apos;t be
                saved and you&apos;ll need to upload it again.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" className="h-11" variant="tertiary">
                Keep uploading
              </Button>
              <Button
                className="h-11"
                variant="danger"
                onPress={() => {
                  setIsConfirming(false);
                  onCancel();
                }}
              >
                Cancel upload
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
