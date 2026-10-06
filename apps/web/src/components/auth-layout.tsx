import { Globe, Link as LinkIcon, ShieldCheck } from '@gravity-ui/icons';
import type { ReactNode } from 'react';
import { Logo } from './logo';

const features = [
  {
    icon: Globe,
    title: 'Works in your browser',
    text: 'Join a call from any device. Nothing to install.',
  },
  {
    icon: LinkIcon,
    title: 'One link per meeting',
    text: 'Create a meeting and share the link with your team.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure sign-in',
    text: 'Your password is hashed and never stored in plain text.',
  },
];

/** Two-column auth screen: brand panel on desktop, form column everywhere. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-accent p-12 text-accent-foreground lg:flex xl:p-16">
        <Logo inverted />

        <div className="flex max-w-xl flex-col gap-10">
          <p className="text-4xl font-semibold tracking-tight text-balance xl:text-5xl">
            Meet face to face, wherever your team is.
          </p>
          <ul className="flex flex-col gap-6">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-foreground/15">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{title}</p>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm">© {new Date().getFullYear()} Video Meetings</p>
      </aside>

      <section className="flex flex-col items-center px-6 py-12 sm:justify-center sm:px-12 lg:py-16">
        <div className="flex w-full max-w-md flex-col gap-8">
          <Logo className="lg:hidden" />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {title}
            </h1>
            <p className="text-pretty text-muted">{subtitle}</p>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
