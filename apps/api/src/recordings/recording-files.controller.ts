import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import { ResolveSignedRecordingQuery } from './queries/resolve-signed-recording/resolve-signed-recording.query';
import { recordingNotFound } from './recording-response';
import { RecordingUrlPurpose } from './recording-url-signer';

interface SendError extends Error {
  code?: string;
  status?: number;
  headers?: Record<string, string>;
}

// Stream and download, authorized by the signed `token` in the URL (from
// GET /meetings/:id/recordings/:recordingId/urls), not by a Bearer header.
// Express's sendFile/download (the `send` package) handle Range (206, 416),
// ETag and HEAD. The token is checked first, so a bad token is 404 even on a
// Range request.
@Controller('recordings/:recordingId')
export class RecordingFilesController {
  private readonly logger = new Logger(RecordingFilesController.name);

  constructor(private readonly queryBus: QueryBus) {}

  @Get('stream')
  async stream(
    @Param('recordingId') recordingId: string,
    @Query('token') token: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.resolve(recordingId, token, 'stream');
    res.sendFile(
      file.path,
      { headers: this.headers(file.mimeType), ...SEND_OPTIONS },
      (err) => this.onSendError(err, res),
    );
  }

  @Get('download')
  async download(
    @Param('recordingId') recordingId: string,
    @Query('token') token: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.resolve(recordingId, token, 'download');
    // Sets Content-Disposition: attachment with filename and, for non-ASCII
    // names, filename*.
    res.download(
      file.path,
      file.originalName,
      { headers: this.headers(file.mimeType), ...SEND_OPTIONS },
      (err) => this.onSendError(err, res),
    );
  }

  private resolve(
    recordingId: string,
    token: unknown,
    purpose: RecordingUrlPurpose,
  ) {
    return this.queryBus.execute(
      new ResolveSignedRecordingQuery(
        recordingId,
        typeof token === 'string' ? token : '',
        purpose,
      ),
    );
  }

  // Stored files have no extension; the stored MIME type is set explicitly so
  // `send` doesn't guess.
  private headers(mimeType: string): Record<string, string> {
    return {
      'Content-Type': mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    };
  }

  // `send` reports 416 and a missing file through this callback instead of
  // answering itself. A client abort (common while seeking) is not an error.
  private onSendError(err: SendError | undefined, res: Response): void {
    if (
      !err ||
      res.headersSent ||
      res.destroyed ||
      err.code === 'ECONNABORTED'
    ) {
      return;
    }
    const status = err.status ?? 500;
    if (status === 404) {
      this.logger.error(`Recording file is missing: ${err.message}`);
      const notFound = recordingNotFound();
      res.status(404).json(notFound.getResponse());
      return;
    }
    if (status >= 500) {
      this.logger.error('Could not send recording file', err);
    }
    res
      .status(status)
      .set(err.headers ?? {})
      .end();
  }
}

// The storage key is a UUID, so no dotfile can be served, but RECORDINGS_DIR
// itself may sit under a dot directory. Cache-Control comes from headers().
const SEND_OPTIONS = { dotfiles: 'allow', cacheControl: false } as const;
