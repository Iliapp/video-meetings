import { User } from '../generated/prisma/client';

// What the signed-in user sees of their own record; the password hash stays
// internal. avatarUrl is always null until avatars exist.
export interface ProfileResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export const toProfileResponse = ({
  id,
  email,
  name,
}: User): ProfileResponse => ({ id, email, name, avatarUrl: null });
