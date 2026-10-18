'use client';

import {
  ArrowDownToLine,
  Clock,
  Headphones,
  HardDrive,
  Play,
  TrashBin,
  Video,
  Xmark,
} from '@gravity-ui/icons';
import { Button, Chip, Spinner, Tooltip } from '@heroui/react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import type { Recording } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/recordings';

const uploadedFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function RecordingRow({
  recording,
  isPlayerOpen,
  pendingAction,
  onPlay,
  onClosePlayer,
  onDownload,
  onDelete,
  player,
}: {
  recording: Recording;
  isPlayerOpen: boolean;
  /** The action waiting for its signed URL. */
  pendingAction: 'play' | 'download' | null;
  onPlay: () => void;
  onClosePlayer: () => void;
  onDownload: () => void;
  /** Owner only; left out for invited users. */
  onDelete?: () => void;
  player: ReactNode;
}) {
  const isVideo = recording.kind === 'video';
  const Icon = isVideo ? Video : Headphones;
  const name = recording.originalName;

  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span
          aria-hidden
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
            isVideo
              ? 'bg-accent-soft text-accent-soft-foreground'
              : 'bg-default text-foreground'
          }`}
        >
          <Icon className="size-5" />
        </span>
        {/* Full width on phones, so the actions wrap below the details. */}
        <div className="flex min-w-0 flex-1 basis-[calc(100%-4.25rem)] flex-col gap-1.5 sm:basis-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium" title={name}>
              {name}
            </p>
            <Chip
              size="sm"
              variant="soft"
              color={isVideo ? 'accent' : 'default'}
              className="shrink-0"
            >
              {isVideo ? 'Video' : 'Audio'}
            </Chip>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <HardDrive aria-hidden className="size-3.5" />
              <span className="sr-only">Size </span>
              {formatBytes(recording.sizeBytes)}
            </span>
            <span className="flex items-center gap-1.5 tabular-nums">
              <Clock aria-hidden className="size-3.5" />
              <span className="sr-only">Duration </span>
              {recording.durationSeconds === null ? (
                <span title="Duration unknown">
                  {formatDuration(null)}
                  <span className="sr-only"> (unknown)</span>
                </span>
              ) : (
                formatDuration(recording.durationSeconds)
              )}
            </span>
          </p>
          <p className="flex min-w-0 flex-wrap gap-x-1 text-sm text-muted">
            <span>
              Uploaded{' '}
              <time dateTime={recording.createdAt}>
                {uploadedFormat.format(new Date(recording.createdAt))}
              </time>
            </span>
            <span className="min-w-0 truncate" title={recording.uploaderEmail}>
              by {recording.uploaderEmail}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 max-sm:ml-15 sm:-mr-2">
          {isPlayerOpen ? (
            <RowAction
              label={`Close player for ${name}`}
              tooltip="Close player"
              icon={Xmark}
              onPress={onClosePlayer}
            />
          ) : (
            <RowAction
              label={`Play ${name}`}
              tooltip="Play"
              icon={Play}
              isPending={pendingAction === 'play'}
              onPress={onPlay}
            />
          )}
          <RowAction
            label={`Download ${name}`}
            tooltip="Download"
            icon={ArrowDownToLine}
            isPending={pendingAction === 'download'}
            onPress={onDownload}
          />
          {onDelete && (
            <RowAction
              label={`Delete ${name}`}
              tooltip="Delete"
              icon={TrashBin}
              isDanger
              onPress={onDelete}
            />
          )}
        </div>
      </div>
      {player && <div className="sm:pl-15">{player}</div>}
    </li>
  );
}

export function RowAction({
  label,
  tooltip,
  icon: Icon,
  isPending = false,
  isDanger = false,
  onPress,
}: {
  label: string;
  tooltip: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  isPending?: boolean;
  isDanger?: boolean;
  onPress: () => void;
}) {
  return (
    <Tooltip delay={300}>
      <Button
        isIconOnly
        aria-label={label}
        variant="ghost"
        isPending={isPending}
        className={`size-11 ${isDanger ? 'text-danger hover:bg-danger-soft' : ''}`}
        onPress={onPress}
      >
        {isPending ? (
          <Spinner color="current" size="sm" />
        ) : (
          <Icon aria-hidden className="size-5" />
        )}
      </Button>
      <Tooltip.Content>
        <p>{tooltip}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
