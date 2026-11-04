import { request } from './client';

export interface AuthResponse {
  accessToken: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export const register = (credentials: Credentials) =>
  request<AuthResponse>('POST', '/auth/register', { body: credentials });

export const login = (credentials: Credentials) =>
  request<AuthResponse>('POST', '/auth/login', { body: credentials });

/**
 * `204`; the current session stays valid. A wrong current password is `400`
 * with `field: 'currentPassword'` (not `401`, so it isn't mistaken for a lost
 * session), a new password under 8 characters `400`, a concurrent change
 * `409`.
 */
export const changePassword = (
  token: string,
  passwords: { currentPassword: string; newPassword: string },
) => request<void>('POST', '/auth/change-password', { body: passwords, token });
