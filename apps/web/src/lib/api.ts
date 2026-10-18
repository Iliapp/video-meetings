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

/** Signed, expiring URLs; the browser loads them without the access token. */
export interface RecordingUrls {
  streamUrl: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface NewMeeting {
  title: string;
  date: string;
  participants: string[];
}

/** The Nest error message, or a non-empty fallback (statusText is empty over HTTP/2). */
function errorMessage(data: unknown, status: number): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message) && message.length) return message.join(', ');
  if (typeof message === 'string' && message) return message;
  return `Request failed (${status})`;
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
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
    throw new ApiError(response.status, errorMessage(data, response.status));
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

const recordingPath = (meetingId: string, recordingId: string) =>
  `/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}`;

/** `404` when the recording (or access to the meeting) is gone. */
export const getRecordingUrls = (
  token: string,
  meetingId: string,
  recordingId: string,
) =>
  request<RecordingUrls>(
    'GET',
    `${recordingPath(meetingId, recordingId)}/urls`,
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
      // `responseType = 'json'` gives null for an empty or non-JSON body.
      const data: unknown = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        if (data && typeof data === 'object' && 'id' in data) {
          resolve(data as Recording);
        } else {
          reject(
            new ApiError(xhr.status, 'Unexpected response from the server.'),
          );
        }
        return;
      }
      reject(new ApiError(xhr.status, errorMessage(data, xhr.status)));
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
