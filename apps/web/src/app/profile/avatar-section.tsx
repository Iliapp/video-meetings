'use client';

import { ArrowRotateRight, ArrowUpFromLine, TrashBin } from '@gravity-ui/icons';
import { Alert, AlertDialog, Button, Spinner } from '@heroui/react';
import { useEffect, useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { UserAvatar } from '@/components/user-avatar';
import { ApiError, UPLOAD_FAILED_MESSAGE, type Profile } from '@/lib/api';
import {
  ACCEPTED_AVATAR_TYPES,
  AVATAR_FORMATS_HINT,
  validateAvatarFile,
} from '@/lib/avatars';

type UploadState =
  | { status: 'idle' }
  // `preview` is an object URL of the picked file, shown until it is saved.
  | { status: 'uploading'; preview: string }
  // `retryFile` is set when the same file may succeed on a second try
  // (network or server failure), not for format or size problems.
  | { status: 'error'; message: string; retryFile?: File }
  | { status: 'done'; message: string };

const isRetryable = (e: unknown) =>
  !(e instanceof ApiError) || e.status === 0 || e.status >= 500;

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

// The avatar with the name and email, and the controls to upload, replace and
// remove it. The shared profile store updates the header on success.
export function AvatarSection({
  profile,
  saveAvatar,
  removeAvatar,
  onUnauthorized,
}: {
  profile: Profile;
  saveAvatar: (file: File) => Promise<Profile>;
  removeAvatar: () => Promise<Profile>;
  onUnauthorized: () => void;
}) {
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' });
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const preview = upload.status === 'uploading' ? upload.preview : null;
  // Free the preview once it is replaced or the page goes away.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const isUploading = upload.status === 'uploading';
  const hasAvatar = profile.avatarUrl !== null;

  async function uploadFile(file: File) {
    const reason = validateAvatarFile(file);
    if (reason) {
      setUpload({ status: 'error', message: reason });
      return;
    }
    setUpload({ status: 'uploading', preview: URL.createObjectURL(file) });
    try {
      await saveAvatar(file);
      setUpload({ status: 'done', message: 'Photo updated' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onUnauthorized();
        return;
      }
      setUpload({
        status: 'error',
        message: errorText(e, UPLOAD_FAILED_MESSAGE),
        retryFile: isRetryable(e) ? file : undefined,
      });
    }
  }

  async function confirmRemove() {
    setRemoveError(null);
    setIsRemoving(true);
    try {
      await removeAvatar();
      setIsRemoveOpen(false);
      setUpload({ status: 'done', message: 'Photo removed' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onUnauthorized();
        return;
      }
      setRemoveError(
        errorText(e, 'Failed to connect to the server. Please try again.'),
      );
    }
    setIsRemoving(false);
  }

  return (
    <section aria-label="Photo" className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <UserAvatar
          name={profile.name}
          email={profile.email}
          avatarUrl={preview ?? profile.avatarUrl}
          size="lg"
          className="size-20 shrink-0 rounded-full text-2xl"
        />
        <div className="flex min-w-0 flex-col">
          <p className="font-semibold break-words">
            {profile.name ?? profile.email}
          </p>
          {profile.name && (
            <p className="text-sm break-all text-muted">{profile.email}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FileTrigger
          acceptedFileTypes={ACCEPTED_AVATAR_TYPES}
          onSelect={(files) => {
            const file = files?.[0];
            if (file) void uploadFile(file);
          }}
        >
          <Button
            className="h-11 max-sm:flex-1"
            variant="secondary"
            isDisabled={isUploading}
          >
            <ArrowUpFromLine aria-hidden className="size-4" />
            {hasAvatar ? 'Change photo' : 'Upload photo'}
          </Button>
        </FileTrigger>
        {hasAvatar && (
          <Button
            className="h-11 max-sm:flex-1"
            variant="danger-soft"
            isDisabled={isUploading}
            onPress={() => {
              setRemoveError(null);
              setIsRemoveOpen(true);
            }}
          >
            <TrashBin aria-hidden className="size-4" />
            Remove photo
          </Button>
        )}
      </div>
      <p className="text-sm text-muted">{AVATAR_FORMATS_HINT}</p>

      {isUploading && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Spinner color="current" size="sm" />
          Uploading photo…
        </p>
      )}
      {upload.status === 'done' && (
        <Alert role="status" status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{upload.message}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {upload.status === 'error' && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn&apos;t upload photo</Alert.Title>
            <Alert.Description>{upload.message}</Alert.Description>
            {upload.retryFile && (
              <Button
                className="mt-3 h-11"
                size="sm"
                variant="secondary"
                onPress={() => void uploadFile(upload.retryFile!)}
              >
                <ArrowRotateRight aria-hidden className="size-4" />
                Try again
              </Button>
            )}
          </Alert.Content>
        </Alert>
      )}

      <RemoveAvatarDialog
        isOpen={isRemoveOpen}
        isPending={isRemoving}
        error={removeError}
        onConfirm={() => void confirmRemove()}
        onClose={() => setIsRemoveOpen(false)}
      />
    </section>
  );
}

/** Confirms removing the avatar; stays open with the error if it fails. */
function RemoveAvatarDialog({
  isOpen,
  isPending,
  error,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isPending) onClose();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[440px]">
          <AlertDialog.CloseTrigger isDisabled={isPending} />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Remove photo?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-4">
            <p>Your initials will show instead. You can upload a new photo.</p>
            {error && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t remove photo</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button
              className="h-11"
              variant="tertiary"
              isDisabled={isPending}
              onPress={onClose}
            >
              Cancel
            </Button>
            <Button
              className="h-11"
              variant="danger"
              isPending={isPending}
              onPress={onConfirm}
            >
              {({ isPending }) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  {error ? 'Try again' : 'Remove'}
                </>
              )}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
