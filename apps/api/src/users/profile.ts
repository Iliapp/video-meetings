import { Prisma } from '../generated/prisma/client';

// What `GET /users/me` and `PATCH /users/me` return; the password hash never leaves the module.
export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export const profileSelect = {
  id: true,
  email: true,
  name: true,
} satisfies Prisma.UserSelect;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

export const toProfile = ({ id, email, name }: ProfileRow): Profile => ({
  id,
  email,
  name,
  avatarUrl: null,
});
