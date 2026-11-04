export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '');

export const UPLOAD_FAILED_MESSAGE =
  'Upload failed. Check your connection and try again.';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // The request field the error is about, when the api names one.
    readonly field?: string,
  ) {
    super(message);
  }
}

/** The Nest error message, or a non-empty fallback (statusText is empty over HTTP/2). */
export function errorMessage(data: unknown, status: number): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message) && message.length) return message.join(', ');
  if (typeof message === 'string' && message) return message;
  return `Request failed (${status})`;
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  { body, token }: { body?: unknown; token?: string } = {},
): Promise<T> {
  // FormData goes as is: the browser sets the multipart Content-Type.
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (body !== undefined && !isForm) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const field = (data as { field?: unknown } | null)?.field;
    throw new ApiError(
      response.status,
      errorMessage(data, response.status),
      typeof field === 'string' ? field : undefined,
    );
  }

  return data as T;
}
