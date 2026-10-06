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
