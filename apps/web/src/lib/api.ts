const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthResponse {
  accessToken: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recording {
  id: string;
  meetingId: string;
  originalName: string;
  mimeType: string;
  kind: 'video' | 'audio';
  sizeBytes: number;
  /** `null` when the browser couldn't read it before upload. */
  durationSeconds: number | null;
  createdAt: string;
  uploaderEmail: string;
}

export interface NewMeeting {
  title: string;
  date: string;
  participants: string[];
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  { body, token }: { body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data as { message?: string | string[] } | null)?.message;
    throw new ApiError(
      response.status,
      Array.isArray(message)
        ? message.join(', ')
        : (message ?? response.statusText),
    );
  }

  return data as T;
}

export const register = (credentials: Credentials) =>
  request<AuthResponse>('POST', '/auth/register', { body: credentials });

export const login = (credentials: Credentials) =>
  request<AuthResponse>('POST', '/auth/login', { body: credentials });

export const listMeetings = (token: string) =>
  request<Meeting[]>('GET', '/meetings', { token });

export const createMeeting = (token: string, meeting: NewMeeting) =>
  request<Meeting>('POST', '/meetings', { body: meeting, token });

/** `404` when the meeting doesn't exist or the user isn't its owner or invited. */
export const getMeeting = (token: string, id: string) =>
  request<Meeting>('GET', `/meetings/${encodeURIComponent(id)}`, { token });

/** Newest first. `404` like `getMeeting`. */
export const listRecordings = (token: string, meetingId: string) =>
  request<Recording[]>(
    'GET',
    `/meetings/${encodeURIComponent(meetingId)}/recordings`,
    { token },
  );

export const UPLOAD_FAILED_MESSAGE =
  'Upload failed. Check your connection and try again.';

/**
 * Uploads with XMLHttpRequest, because `fetch` can't report upload progress.
 * Rejects with an `AbortError` DOMException when `signal` aborts, and with
 * `ApiError` otherwise (status 0 for a network failure).
 */
export function uploadRecording(
  token: string,
  meetingId: string,
  file: File,
  durationSeconds: number | undefined,
  {
    signal,
    onProgress,
  }: { signal: AbortSignal; onProgress: (fraction: number) => void },
): Promise<Recording> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `${API_URL}/meetings/${encodeURIComponent(meetingId)}/recordings`,
    );
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const data = xhr.response as
        Recording | { message?: string | string[] } | null;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as Recording);
        return;
      }
      const message = (data as { message?: string | string[] } | null)?.message;
      reject(
        new ApiError(
          xhr.status,
          Array.isArray(message)
            ? message.join(', ')
            : (message ?? xhr.statusText),
        ),
      );
    };
    xhr.onerror = () => reject(new ApiError(0, UPLOAD_FAILED_MESSAGE));
    xhr.onabort = () =>
      reject(new DOMException('Upload cancelled', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });

    const body = new FormData();
    if (durationSeconds !== undefined) {
      body.append('durationSeconds', String(durationSeconds));
    }
    // Last, after the text fields, so the api has them before the file.
    body.append('file', file);
    xhr.send(body);
  });
}
