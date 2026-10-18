import { NotFoundException } from '@nestjs/common';
import { Prisma, RecordingKind } from '../generated/prisma/client';

// What the api returns for a recording. The storage key stays internal.
export interface RecordingResponse {
  id: string;
  meetingId: string;
  originalName: string;
  mimeType: string;
  kind: RecordingKind;
  sizeBytes: number;
  durationSeconds: number | null;
  createdAt: Date;
  uploaderEmail: string;
}

export const recordingWithUploader = {
  uploader: { select: { email: true } },
} satisfies Prisma.RecordingInclude;

type RecordingWithUploader = Prisma.RecordingGetPayload<{
  include: typeof recordingWithUploader;
}>;

// JSON.stringify throws on BigInt; sizes are far below Number.MAX_SAFE_INTEGER.
export const toRecordingResponse = ({
  id,
  meetingId,
  originalName,
  mimeType,
  kind,
  sizeBytes,
  durationSeconds,
  createdAt,
  uploader,
}: RecordingWithUploader): RecordingResponse => ({
  id,
  meetingId,
  originalName,
  mimeType,
  kind,
  sizeBytes: Number(sizeBytes),
  durationSeconds,
  createdAt,
  uploaderEmail: uploader.email,
});

// Unknown, malformed, deleted or another meeting's recording, and every bad
// signed token, look the same to the caller.
export const recordingNotFound = () =>
  new NotFoundException('Recording not found');
