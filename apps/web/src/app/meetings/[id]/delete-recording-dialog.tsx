'use client';

import { Alert, AlertDialog, Button, Spinner } from '@heroui/react';
import type { Recording } from '@/lib/api';

/** Confirms deleting a recording; stays open with the error if it fails. */
export function DeleteRecordingDialog({
  recording,
  isOpen,
  isPending,
  error,
  onConfirm,
  onClose,
}: {
  /** Kept after closing, so the text doesn't vanish while it animates out. */
  recording: Recording | null;
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
            <AlertDialog.Heading>Delete recording?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-4">
            <p>
              <strong className="break-all">{recording?.originalName}</strong>{' '}
              will be deleted for everyone in this meeting, and its links will
              stop working. This can&apos;t be undone.
            </p>
            {error && recording && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    Couldn&apos;t delete {recording.originalName}
                  </Alert.Title>
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
                  {error ? 'Try again' : 'Delete'}
                </>
              )}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
