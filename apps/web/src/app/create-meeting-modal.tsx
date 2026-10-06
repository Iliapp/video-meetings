'use client';

import { Calendar } from '@gravity-ui/icons';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
} from '@heroui/react';
import { useState, type FormEvent } from 'react';
import { isEmail } from '@/components/email-field';
import { ApiError, createMeeting, type Meeting } from '@/lib/api';

const FORM_ID = 'create-meeting-form';

/** `YYYY-MM-DDTHH:mm` in local time, the format of `<input type="datetime-local">`. */
function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nextFullHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return toLocalInputValue(date);
}

const parseParticipants = (value: string) =>
  value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);

export function CreateMeetingModal({
  isOpen,
  onOpenChange,
  token,
  onCreated,
  onUnauthorized,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  token: string;
  onCreated: (meeting: Meeting) => void;
  onUnauthorized: () => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(nextFullHour);
  const [participants, setParticipants] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setDate(nextFullHour());
    setParticipants('');
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const meeting = await createMeeting(token, {
        title: title.trim(),
        date: new Date(date).toISOString(),
        participants: parseParticipants(participants),
      });
      onCreated(meeting);
      onOpenChange(false);
      reset();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onUnauthorized();
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Failed to connect to the server. Please try again.');
      }
    }
    setIsPending(false);
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Calendar className="size-5" />
            </Modal.Icon>
            <Modal.Heading>New meeting</Modal.Heading>
            <p className="mt-1.5 text-sm text-muted">
              Pick a time and invite people by email.
            </p>
          </Modal.Header>
          <Modal.Body className="p-1">
            <Form
              id={FORM_ID}
              className="flex flex-col gap-5"
              onSubmit={(e) => void onSubmit(e)}
            >
              {error && (
                <Alert role="alert" status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Couldn&apos;t create the meeting</Alert.Title>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <TextField
                fullWidth
                autoFocus
                className="gap-2"
                isRequired
                name="title"
                value={title}
                onChange={setTitle}
                validate={(value) =>
                  value.trim() ? null : 'Give the meeting a title'
                }
              >
                <Label>Title</Label>
                <Input className="h-11" placeholder="Weekly sync" />
                <FieldError className="px-0 text-sm" />
              </TextField>

              <TextField
                fullWidth
                className="gap-2"
                isRequired
                name="date"
                value={date}
                onChange={setDate}
                validate={(value) => {
                  const time = new Date(value).getTime();
                  if (Number.isNaN(time)) return 'Pick a date and time';
                  return time > Date.now() ? null : 'Pick a time in the future';
                }}
              >
                <Label>Date and time</Label>
                <Input className="h-11" type="datetime-local" />
                <FieldError className="px-0 text-sm" />
              </TextField>

              <TextField
                fullWidth
                className="gap-2"
                name="participants"
                value={participants}
                onChange={setParticipants}
                validate={(value) => {
                  const invalid = parseParticipants(value).filter(
                    (email) => !isEmail(email),
                  );
                  return invalid.length
                    ? `Not a valid email: ${invalid.join(', ')}`
                    : null;
                }}
              >
                <Label>Participants</Label>
                <Input
                  className="h-11"
                  autoComplete="off"
                  placeholder="anna@company.com, max@…"
                />
                <Description className="text-sm">
                  Optional. Separate emails with commas.
                </Description>
                <FieldError className="px-0 text-sm" />
              </TextField>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              form={FORM_ID}
              isPending={isPending}
              type="submit"
              variant="primary"
            >
              {({ isPending }) =>
                isPending ? (
                  <>
                    <Spinner color="current" size="sm" />
                    Creating…
                  </>
                ) : (
                  'Create meeting'
                )
              }
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
