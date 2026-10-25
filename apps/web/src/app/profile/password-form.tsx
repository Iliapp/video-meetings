'use client';

import { Alert, Button, Form, Spinner } from '@heroui/react';
import { useRef, useState, type FormEvent } from 'react';
import { PasswordField } from '@/components/password-field';
import { ApiError, changePassword } from '@/lib/api';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/passwords';

// The api's `409` says "try again", but the password was already changed by
// another request (another tab, or a retried request that went through), so
// the same current password would now be wrong.
const CHANGED_ELSEWHERE =
  "Your password was just changed in another request, so this change wasn't saved. Use your latest password the next time you sign in.";

type Feedback =
  { status: 'success' } | { status: 'error'; message: string } | null;

const noError = () => null;

// Current, new and confirmed password. The session stays signed in after a
// change; the api keeps issued tokens valid.
export function PasswordForm({
  email,
  token,
  onUnauthorized,
}: {
  email: string;
  token: string;
  onUnauthorized: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Field errors show from the first submit on and update as the user types.
  // react-aria's default shows them on submit but clears them only on blur;
  // the layout shift then makes a click on the button miss.
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Server errors per field name. Cleared on edit, not left to react-aria,
  // which clears them only on blur (the same layout shift as above).
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const currentInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const confirmationInputRef = useRef<HTMLInputElement>(null);

  const validateCurrent = (value: string) =>
    value ? null : 'Enter your current password';
  const validateConfirmation = (value: string) =>
    value === newPassword ? null : "Passwords don't match";

  function edit(setValue: (value: string) => void) {
    return (value: string) => {
      setValue(value);
      // A success or an error is about the values sent, not the new ones.
      if (feedback) setFeedback(null);
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
    const invalid = (
      [
        [currentInputRef, validateCurrent(currentPassword)],
        [newInputRef, validateNewPassword(newPassword)],
        [confirmationInputRef, validateConfirmation(confirmation)],
      ] as const
    ).find(([, error]) => error);
    if (invalid) {
      invalid[0].current?.focus();
      return;
    }

    setFeedback(null);
    setServerErrors({});
    setIsPending(true);
    try {
      await changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setIsSubmitted(false);
      setFeedback({ status: 'success' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onUnauthorized();
        return;
      }
      // A wrong current password is a 400 (not a 401, so it isn't taken for a
      // lost session) that names the field.
      if (
        e instanceof ApiError &&
        e.status === 400 &&
        e.field === 'currentPassword'
      ) {
        setServerErrors({ currentPassword: e.message });
        currentInputRef.current?.focus();
      } else {
        setFeedback({
          status: 'error',
          message: !(e instanceof ApiError)
            ? 'Failed to connect to the server. Please try again.'
            : e.status === 409
              ? CHANGED_ELSEWHERE
              : e.message,
        });
      }
    }
    setIsPending(false);
  }

  return (
    <Form
      aria-labelledby="password-heading"
      className="flex flex-col gap-6"
      validationBehavior="aria"
      validationErrors={serverErrors}
      onSubmit={(e) => void onSubmit(e)}
    >
      <div className="flex flex-col gap-1">
        <h2 id="password-heading" className="text-lg font-semibold">
          Password
        </h2>
        <p className="text-sm text-muted">
          You stay signed in on this device after the change.
        </p>
      </div>

      {feedback?.status === 'success' && (
        <Alert role="status" status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Password changed</Alert.Title>
            <Alert.Description>
              Use your new password the next time you sign in.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {feedback?.status === 'error' && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn&apos;t change your password</Alert.Title>
            <Alert.Description>{feedback.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* Tells password managers which account the new password is for. */}
      <input
        hidden
        readOnly
        autoComplete="username"
        name="username"
        type="email"
        value={email}
      />

      <PasswordField
        label="Current password"
        name="currentPassword"
        value={currentPassword}
        onChange={edit((value) => {
          setCurrentPassword(value);
          setServerErrors({});
        })}
        autoComplete="current-password"
        inputRef={currentInputRef}
        validate={isSubmitted ? validateCurrent : noError}
      />

      <PasswordField
        label="New password"
        name="newPassword"
        value={newPassword}
        onChange={edit(setNewPassword)}
        autoComplete="new-password"
        description={`At least ${MIN_PASSWORD_LENGTH} characters`}
        inputRef={newInputRef}
        validate={isSubmitted ? validateNewPassword : noError}
      />

      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        value={confirmation}
        onChange={edit(setConfirmation)}
        autoComplete="new-password"
        inputRef={confirmationInputRef}
        validate={isSubmitted ? validateConfirmation : noError}
      />

      <Button
        className="h-11 self-start rounded-xl px-6"
        isPending={isPending}
        type="submit"
        variant="primary"
      >
        {({ isPending }) =>
          isPending ? (
            <>
              <Spinner color="current" size="sm" />
              Changing…
            </>
          ) : (
            'Change password'
          )
        }
      </Button>
    </Form>
  );
}
