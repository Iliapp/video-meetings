import { Prisma } from '../generated/prisma/client';
import { AuthUser } from '../auth/auth-user';

// Meetings a user may see: ones they own or are invited to by email.
export const visibleTo = (user: AuthUser): Prisma.MeetingWhereInput => ({
  OR: [{ ownerId: user.id }, { participants: { has: user.email } }],
});
