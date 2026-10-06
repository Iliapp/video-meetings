'use client';

import { Alert, Button, Form, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { EmailField } from '@/components/email-field';
import { PasswordField } from '@/components/password-field';
import { TextLink } from '@/components/text-link';
import { ApiError, register } from '@/lib/api';
import { saveAccessToken } from '@/lib/auth-token';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [isStorageBlocked, setIsStorageBlocked] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidationErrors({});
    setIsPending(true);

    let accessToken: string;
    try {
      ({ accessToken } = await register({ email, password }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setValidationErrors({
          email: 'An account with this email already exists',
        });
        emailInputRef.current?.focus();
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Failed to connect to the server. Please try again.');
      }
      setIsPending(false);
      return;
    }

    // The account exists at this point; a blocked localStorage must not look like a failed sign-up.
    try {
      saveAccessToken(accessToken);
    } catch {
      setIsStorageBlocked(true);
      setIsPending(false);
      return;
    }
    router.replace('/');
  }

  if (isStorageBlocked) {
    return (
      <Alert role="status" status="success">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Account created</Alert.Title>
          <Alert.Description>
            Your browser blocked saving the session. Allow site data, then{' '}
            <TextLink href="/login">sign in</TextLink>.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Form
        className="flex flex-col gap-6"
        validationErrors={validationErrors}
        onSubmit={(e) => void onSubmit(e)}
      >
        {error && (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Couldn&apos;t create your account</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <EmailField
          value={email}
          onChange={setEmail}
          inputRef={emailInputRef}
        />

        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          description={`At least ${MIN_PASSWORD_LENGTH} characters`}
          validate={(value) =>
            value.length >= MIN_PASSWORD_LENGTH
              ? null
              : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
          }
        />

        <Button
          fullWidth
          className="mt-2 h-12 rounded-xl"
          isPending={isPending}
          size="lg"
          type="submit"
          variant="primary"
        >
          {({ isPending }) =>
            isPending ? (
              <>
                <Spinner color="current" size="sm" />
                Creating account…
              </>
            ) : (
              'Create account'
            )
          }
        </Button>
      </Form>

      <p className="text-center text-muted">
        Already have an account? <TextLink href="/login">Sign in</TextLink>
      </p>
    </div>
  );
}
