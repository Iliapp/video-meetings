import { Video } from '@gravity-ui/icons';

export function Logo({
  className = '',
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 font-semibold ${className}`}>
      <span
        className={`flex size-8 items-center justify-center rounded-lg ${
          inverted
            ? 'bg-accent-foreground text-accent'
            : 'bg-accent text-accent-foreground'
        }`}
      >
        <Video aria-hidden className="size-4" />
      </span>
      Video Meetings
    </div>
  );
}
