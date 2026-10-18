'use client';

import { Alert } from '@heroui/react';
import { useRef, useState, type SyntheticEvent } from 'react';
import type { Recording } from '@/lib/api';

/**
 * In-page player for a signed stream URL. The URL expires (`RECORDING_URL_TTL`),
 * and the browser asks for the file again on seeks past the buffer, so a media
 * error fetches fresh URLs through `refreshUrl` and resumes where it stopped.
 */
export function RecordingPlayer({
  recording,
  streamUrl,
  refreshUrl,
}: {
  recording: Recording;
  streamUrl: string;
  /** Resolves to a new stream URL, or `null` when the recording is gone. */
  refreshUrl: () => Promise<string | null>;
}) {
  const [src, setSrc] = useState(streamUrl);
  const [failed, setFailed] = useState(false);
  const position = useRef(0);
  const wasPlaying = useRef(true);
  // Where to seek once metadata loads; the first load starts playing at 0.
  // Not `autoPlay`, which would also restart a paused player after a refresh.
  const resumeAt = useRef<number | null>(0);
  // One refresh per failure: a second error before the media is playable
  // again means the file itself can't be played.
  const isRefreshing = useRef(false);
  const hasRetried = useRef(false);

  const onTimeUpdate = (e: SyntheticEvent<HTMLMediaElement>) => {
    const media = e.currentTarget;
    // `load()` resets the position to 0 before the error; keep the real one.
    if (media.readyState > HTMLMediaElement.HAVE_NOTHING) {
      position.current = media.currentTime;
    }
  };

  const onLoadedMetadata = (e: SyntheticEvent<HTMLMediaElement>) => {
    const media = e.currentTarget;
    if (resumeAt.current === null) return;
    media.currentTime = resumeAt.current;
    resumeAt.current = null;
    if (wasPlaying.current) void media.play().catch(() => {});
  };

  const onError = () => {
    if (isRefreshing.current) return;
    if (hasRetried.current) {
      setFailed(true);
      return;
    }
    isRefreshing.current = true;
    hasRetried.current = true;
    void refreshUrl()
      .then((url) => {
        // `null`: the recording is gone, and the parent closes the player.
        if (url) {
          resumeAt.current = position.current;
          setSrc(url);
        }
      })
      .catch(() => setFailed(true))
      .finally(() => {
        isRefreshing.current = false;
      });
  };

  const mediaProps = {
    src,
    controls: true,
    preload: 'metadata',
    'aria-label': `${recording.originalName} player`,
    onTimeUpdate,
    // `seeking` already has the target, even if the seek then fails on an
    // expired URL before `seeked`.
    onSeeking: onTimeUpdate,
    onSeeked: onTimeUpdate,
    onLoadedMetadata,
    onCanPlay: () => {
      hasRetried.current = false;
    },
    onPlay: () => {
      wasPlaying.current = true;
    },
    onPause: (e: SyntheticEvent<HTMLMediaElement>) => {
      if (e.currentTarget.readyState > HTMLMediaElement.HAVE_NOTHING) {
        wasPlaying.current = false;
      }
    },
    onError,
  } as const;

  return (
    <div className="flex flex-col gap-3">
      {recording.kind === 'video' ? (
        <video
          {...mediaProps}
          playsInline
          className="aspect-video max-h-[70vh] w-full rounded-xl bg-black"
        />
      ) : (
        <audio {...mediaProps} className="w-full" />
      )}
      {failed && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              Couldn&apos;t play {recording.originalName}
            </Alert.Title>
            <Alert.Description>
              Check your connection, or download the file and play it on your
              device.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}
