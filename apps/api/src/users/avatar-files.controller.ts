import { Controller, Get, Logger, Param, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import { avatarNotFound } from './queries/resolve-avatar/resolve-avatar.handler';
import { ResolveAvatarQuery } from './queries/resolve-avatar/resolve-avatar.query';

interface SendError extends Error {
  code?: string;
  status?: number;
  headers?: Record<string, string>;
}

// The storage key is a UUID, so no dotfile can be served, but AVATARS_DIR
// itself may sit under a dot directory. Cache-Control is set explicitly.
const SEND_OPTIONS = { dotfiles: 'allow', cacheControl: false } as const;

// GET /avatars/:key, the avatarUrl of a profile. Public, like the signed
// recording URLs: <img src> can't send a Bearer header, and the key is an
// unguessable UUID that changes with every upload. No CORS needed, <img> isn't
// a CORS request.
@Controller('avatars')
export class AvatarFilesController {
  private readonly logger = new Logger(AvatarFilesController.name);

  constructor(private readonly queryBus: QueryBus) {}

  @Get(':key')
  async serve(@Param('key') key: string, @Res() res: Response): Promise<void> {
    const file = await this.queryBus.execute(new ResolveAvatarQuery(key));
    res.sendFile(
      file.path,
      {
        // Stored files have no extension; set the stored type so `send`
        // doesn't guess. no-store as for recordings, so a removed avatar
        // disappears at once.
        headers: {
          'Content-Type': file.mimeType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
        ...SEND_OPTIONS,
      },
      (err: SendError | undefined) => this.onSendError(err, res),
    );
  }

  // A file removed between the lookup and the send (a concurrent replace or
  // delete) is a 404 like an unknown key.
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
      res.status(404).json(avatarNotFound().getResponse());
      return;
    }
    if (status >= 500) {
      this.logger.error('Could not send avatar file', err);
    }
    res
      .status(status)
      .set(err.headers ?? {})
      .end();
  }
}
