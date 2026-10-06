import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/** Inline accent link for client-side navigation inside body text. */
export function TextLink(props: ComponentProps<typeof NextLink>) {
  return (
    <NextLink
      {...props}
      className="rounded-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
    />
  );
}
