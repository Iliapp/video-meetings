'use client';

import { Alert, Button, Form, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EmailField } from '@/components/email-field';
import { PasswordField } from '@/components/password-field';
import { TextLink } from '@/components/text-link';
import { ApiError, login } from '@/lib/api';
import { getSession, saveAccessToken } from '@/lib/auth-token';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<{ title: string; text: string } | null>(
    null,
  );
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Already signed in: skip the form.
  useEffect(() => {
    if (getSession()) router.replace('/');
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const { accessToken } = await login({ email, password });
      saveAccessToken(accessToken);
      router.replace('/');
      return;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError({
          title: 'Incorrect email or password',
          text: 'Check your details and try again.',
        });
        setPassword('');
        passwordInputRef.current?.focus();
      } else if (e instanceof ApiError) {
        setError({ title: 'Couldn’t sign you in', text: e.message });
      } else if (e instanceof DOMException) {
        setError({
          title: 'Couldn’t sign you in',
          text: 'Your browser blocked saving the session. Allow site data and try again.',
        });
      } else {
        setError({
          title: 'Couldn’t sign you in',
          text: 'Failed to connect to the server. Please try again.',
        });
      }
    }
    setIsPending(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Form className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        {error && (
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error.title}</Alert.Title>
              <Alert.Description>{error.text}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <EmailField value={email} onChange={setEmail} />

        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          inputRef={passwordInputRef}
          validate={(value) => (value ? null : 'Enter your password')}
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
                Signing in…
              </>
            ) : (
              'Sign in'
            )
          }
        </Button>
      </Form>

      <p className="text-center text-muted">
        Don&apos;t have an account?{' '}
        <TextLink href="/register">Create one</TextLink>
      </p>
    </div>
  );
}
