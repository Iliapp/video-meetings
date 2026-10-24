'use client';

import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { useState, type FormEvent } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { ApiError, type Profile } from '@/lib/api';

// Same limit as the api: 1-100 characters after trimming, counted in code
// points like its validator.
export const NAME_MAX_LENGTH = 100;
const validateName = (value: string) =>
  Array.from(value.trim()).length > NAME_MAX_LENGTH
    ? `Name must be ${NAME_MAX_LENGTH} characters or fewer`
    : null;

type Feedback =
  { status: 'success' } | { status: 'error'; message: string } | null;

// The read-only email and the editable name. A blank name is sent as `null`,
// which clears it so the app shows the email instead.
export function NameForm({
  profile,
  saveName,
  onUnauthorized,
}: {
  profile: Profile;
  saveName: (name: string | null) => Promise<Profile>;
  onUnauthorized: () => void;
}) {
  const [name, setName] = useState(profile.name ?? '');
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsPending(true);
    try {
      const saved = await saveName(name.trim() || null);
      setName(saved.name ?? '');
      setFeedback({ status: 'success' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onUnauthorized();
        return;
      }
      setFeedback({
        status: 'error',
        message:
          e instanceof ApiError
            ? e.message
            : 'Failed to connect to the server. Please try again.',
      });
    }
    setIsPending(false);
  }

  return (
    <Form className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
      <div className="flex min-w-0 items-center gap-4">
        <UserAvatar
          name={profile.name}
          email={profile.email}
          avatarUrl={profile.avatarUrl}
          size="lg"
          className="size-16 shrink-0 rounded-full text-xl"
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

      {feedback?.status === 'success' && (
        <Alert role="status" status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Profile updated</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {feedback?.status === 'error' && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn&apos;t save your profile</Alert.Title>
            <Alert.Description>{feedback.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <TextField
        fullWidth
        isReadOnly
        className="gap-2"
        name="email"
        type="email"
        value={profile.email}
      >
        <Label>Email</Label>
        {/* Muted fill, so it doesn't read as an editable field; the text keeps
            the foreground color (muted text on the fill is below AA). */}
        <Input className="h-12 bg-default shadow-none" />
        <Description className="text-sm">
          Your sign-in email can&apos;t be changed.
        </Description>
      </TextField>

      <TextField
        fullWidth
        className="gap-2"
        name="name"
        value={name}
        onChange={(value) => {
          setName(value);
          if (feedback?.status === 'success') setFeedback(null);
        }}
        validate={validateName}
      >
        <Label>Name</Label>
        <Input
          autoComplete="name"
          className="h-12"
          placeholder="Your full name"
        />
        <Description className="text-sm">
          Shown in the header and on your dashboard. Leave it empty to show your
          email instead.
        </Description>
        <FieldError className="px-0 text-sm" />
      </TextField>

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
              Saving…
            </>
          ) : (
            'Save'
          )
        }
      </Button>
    </Form>
  );
}
