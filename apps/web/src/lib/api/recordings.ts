import {
  API_URL,
  ApiError,
  UPLOAD_FAILED_MESSAGE,
  errorMessage,
  request,
} from './client';

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

const recordingsPath = (meetingId: string) =>
  `/meetings/${encodeURIComponent(meetingId)}/recordings`;

const recordingPath = (meetingId: string, recordingId: string) =>
  `${recordingsPath(meetingId)}/${encodeURIComponent(recordingId)}`;

/** Newest first. `404` like `getMeeting`. */
export const listRecordings = (token: string, meetingId: string) =>
  request<Recording[]>('GET', recordingsPath(meetingId), { token });

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

/** Owner only (`403` otherwise); `404` when it is already gone. */
export const deleteRecording = (
  token: string,
  meetingId: string,
  recordingId: string,
) => request<void>('DELETE', recordingPath(meetingId, recordingId), { token });

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
    xhr.open('POST', `${API_URL}${recordingsPath(meetingId)}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        resolve(parseUploadResponse(xhr));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new ApiError(0, UPLOAD_FAILED_MESSAGE));
    xhr.onabort = () =>
      reject(new DOMException('Upload cancelled', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.send(uploadBody(file, durationSeconds));
  });
}

/** The created recording, or throws `ApiError`. */
function parseUploadResponse(xhr: XMLHttpRequest): Recording {
  // `responseType = 'json'` gives null for an empty or non-JSON body.
  const data: unknown = xhr.response;
  if (xhr.status < 200 || xhr.status >= 300) {
    throw new ApiError(xhr.status, errorMessage(data, xhr.status));
  }
  if (data && typeof data === 'object' && 'id' in data) {
    return data as Recording;
  }
  throw new ApiError(xhr.status, 'Unexpected response from the server.');
}

function uploadBody(file: File, durationSeconds: number | undefined) {
  const body = new FormData();
  if (durationSeconds !== undefined) {
    body.append('durationSeconds', String(durationSeconds));
  }
  // Last, after the text fields, so the api has them before the file.
  body.append('file', file);
  return body;
}
