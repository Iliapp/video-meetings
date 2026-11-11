import { Avatar } from '@heroui/react';

/**
 * Up to two letters: the first and last word of the name ("Ann Lee" → "AL",
 * "Cher" → "C"), or the email's first letter when there is no name.
 */
export function initials(name: string | null, email: string): string {
  // Code points, not UTF-16 units, so a letter outside the BMP stays whole.
  const firstLetter = (word: string) => Array.from(word)[0] ?? '';
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return firstLetter(email).toUpperCase();
  const last = words.length > 1 ? firstLetter(words[words.length - 1]) : '';
  return (firstLetter(words[0]) + last).toUpperCase();
}

// The user's picture, or a circle with their initials while there is none or
// it hasn't loaded. Decorative: put the name or email next to it as text.
export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = 'md',
  className,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <Avatar
      aria-hidden
      className={className}
      color="accent"
      data-testid="avatar"
      size={size}
    >
      {avatarUrl && <Avatar.Image alt="" src={avatarUrl} />}
      <Avatar.Fallback>{initials(name, email)}</Avatar.Fallback>
    </Avatar>
  );
}
