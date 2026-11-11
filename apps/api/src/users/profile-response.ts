import { User } from '../generated/prisma/client';

// What the signed-in user sees of their own record; the password hash, avatar
// key and MIME type stay internal.
export interface ProfileResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

// Handlers return avatarUrl as a path (/avatars/<key>); ProfileController
// makes it absolute with withAvatarBaseUrl. The key is a random UUID that
// changes with every upload, so the URL is unguessable and needs no Bearer
// header, and an old URL stops working once the avatar is replaced or removed.
export const toProfileResponse = ({
  id,
  email,
  name,
  avatarKey,
}: User): ProfileResponse => ({
  id,
  email,
  name,
  avatarUrl: avatarKey ? `/avatars/${avatarKey}` : null,
});

export const withAvatarBaseUrl = (
  profile: ProfileResponse,
  baseUrl: string,
): ProfileResponse => ({
  ...profile,
  avatarUrl: profile.avatarUrl && `${baseUrl}${profile.avatarUrl}`,
});
