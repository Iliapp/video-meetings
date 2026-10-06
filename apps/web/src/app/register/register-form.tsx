'use client';

import { Eye, EyeSlash } from '@gravity-ui/icons';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  InputGroup,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError, register } from '@/lib/api';
import { saveAccessToken } from '@/lib/auth-token';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
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
      setIsSignedIn(true);
    } catch {
      setIsSignedIn(false);
    }
    setRegisteredEmail(email.trim().toLowerCase());
    setIsPending(false);
  }

  if (registeredEmail) {
    return (
      <Alert role="status" status="success">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Account created</Alert.Title>
          <Alert.Description>
            {isSignedIn ? 'You are signed in as' : 'Your account'}{' '}
            <span className="font-medium">{registeredEmail}</span>
            {isSignedIn
              ? '.'
              : ' is ready, but your browser blocked saving the session. Sign in to continue.'}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
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

      <TextField
        fullWidth
        className="gap-2"
        isRequired
        name="email"
        type="email"
        value={email}
        onChange={setEmail}
        validate={(value) =>
          /^\S+@\S+\.\S+$/.test(value.trim())
            ? null
            : 'Enter an email address like name@company.com'
        }
      >
        <Label>Email</Label>
        <InputGroup fullWidth className="h-12">
          <InputGroup.Input
            ref={emailInputRef}
            autoComplete="email"
            placeholder="name@company.com"
          />
        </InputGroup>
        <FieldError className="px-0 text-sm" />
      </TextField>

      <TextField
        fullWidth
        className="gap-2"
        isRequired
        name="password"
        type={isPasswordVisible ? 'text' : 'password'}
        value={password}
        onChange={setPassword}
        validate={(value) =>
          value.length >= MIN_PASSWORD_LENGTH
            ? null
            : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
        }
      >
        <Label>Password</Label>
        <InputGroup fullWidth className="h-12">
          <InputGroup.Input autoComplete="new-password" />
          <InputGroup.Suffix className="pe-0.5">
            <Button
              isIconOnly
              className="size-11"
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              size="sm"
              variant="ghost"
              onPress={() => setIsPasswordVisible((visible) => !visible)}
            >
              {isPasswordVisible ? (
                <EyeSlash className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
        <Description className="text-sm">
          At least {MIN_PASSWORD_LENGTH} characters
        </Description>
        <FieldError className="px-0 text-sm" />
      </TextField>

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
  );
}
