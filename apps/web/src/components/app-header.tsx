import { ArrowRightFromSquare } from '@gravity-ui/icons';
import { Button } from '@heroui/react';
import NextLink from 'next/link';
import { Logo } from './logo';

// Top bar of signed-in pages: the logo links home, plus a sign-out button.
export function AppHeader({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="border-b border-separator">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <NextLink
          href="/"
          className="rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Logo />
        </NextLink>
        <Button className="h-11" variant="secondary" onPress={onSignOut}>
          <ArrowRightFromSquare aria-hidden className="size-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
