import { ApiError, UPLOAD_FAILED_MESSAGE, request } from './client';

/** The signed-in user's own record from `GET/PATCH /users/me`. */
export interface Profile {
  id: string;
  email: string;
  /** `null` when the user hasn't set one; show the email instead. */
  name: string | null;
  avatarUrl: string | null;
}

export const getProfile = (token: string) =>
  request<Profile>('GET', '/users/me', { token });

/** `name: null` clears it. The api trims it and allows 1-100 characters. */
export const updateProfile = (
  token: string,
  changes: { name: string | null },
) => request<Profile>('PATCH', '/users/me', { body: changes, token });

/**
 * Replaces the avatar with a JPG, PNG or WebP and returns the profile with the
 * new `avatarUrl`. `415` for another format, `413` above the limit; a network
 * failure rejects with `ApiError` status 0.
 */
export async function uploadAvatar(token: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  try {
    return await request<Profile>('PUT', '/users/me/avatar', { body, token });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, UPLOAD_FAILED_MESSAGE);
  }
}

/** `204`, also when there is no avatar. */
export const deleteAvatar = (token: string) =>
  request<void>('DELETE', '/users/me/avatar', { token });
