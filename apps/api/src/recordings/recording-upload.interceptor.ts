import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, Observable } from 'rxjs';
import { formatBytes } from '../common/format-bytes';
import { recordingsConfig, type RecordingsConfig } from './recordings.config';
import { RecordingsStorageService } from './storage/recordings-storage.service';

// Room for the multipart boundaries and the text fields around the file.
const MULTIPART_ALLOWANCE = 64 * 1024;

// Put before FileInterceptor so it wraps it:
// - rejects a too-large Content-Length before multer writes anything;
// - on any later error (validation pipe, handler) deletes the uploaded temp
//   file, so a rejected upload leaves nothing behind;
// - replaces multer's "File too large" with a message that names the limit.
@Injectable()
export class RecordingUploadInterceptor implements NestInterceptor {
  constructor(
    @Inject(recordingsConfig.KEY) private readonly config: RecordingsConfig,
    private readonly storage: RecordingsStorageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      Number(request.headers['content-length']) >
      this.config.maxBytes + MULTIPART_ALLOWANCE
    ) {
      throw this.tooLarge();
    }
    return next.handle().pipe(
      catchError(async (error: unknown) => {
        if (request.file) {
          await this.storage.discard(request.file.path);
        }
        throw error instanceof PayloadTooLargeException
          ? this.tooLarge()
          : error;
      }),
    );
  }

  private tooLarge() {
    return new PayloadTooLargeException(
      `File is larger than ${formatBytes(this.config.maxBytes)}`,
    );
  }
}
