import { randomUUID } from 'node:crypto';
import { Module, UnsupportedMediaTypeException } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AuthModule } from '../auth/auth.module';
import { UploadRecordingHandler } from './commands/upload-recording/upload-recording.handler';
import { MeetingOwnerGuard } from './meeting-owner.guard';
import { GetRecordingUrlsHandler } from './queries/get-recording-urls/get-recording-urls.handler';
import { ListRecordingsHandler } from './queries/list-recordings/list-recordings.handler';
import {
  hasAllowedExtension,
  UNSUPPORTED_FORMAT_MESSAGE,
} from './recording-file';
import { RecordingUploadInterceptor } from './recording-upload.interceptor';
import { RecordingUrlSigner } from './recording-url-signer';
import { recordingsConfig, type RecordingsConfig } from './recordings.config';
import { RecordingsController } from './recordings.controller';
import { RecordingsStorageModule } from './storage/recordings-storage.module';
import { RecordingsStorageService } from './storage/recordings-storage.service';

@Module({
  imports: [
    AuthModule,
    RecordingsStorageModule,
    // Uploads stream to RECORDINGS_DIR/incoming under a random name; multer
    // deletes the partial file itself when the request is aborted or a limit
    // is hit.
    MulterModule.registerAsync({
      imports: [RecordingsStorageModule],
      inject: [recordingsConfig.KEY, RecordingsStorageService],
      useFactory: (
        config: RecordingsConfig,
        storage: RecordingsStorageService,
      ) => ({
        storage: diskStorage({
          destination: storage.incomingDir,
          filename: (_req, _file, cb) => cb(null, randomUUID()),
        }),
        limits: { fileSize: config.maxBytes, files: 1, fields: 5, parts: 6 },
        // multer's default is latin1, which garbles non-ASCII file names.
        defParamCharset: 'utf8',
        fileFilter: (_req, file, cb) =>
          hasAllowedExtension(file.originalname)
            ? cb(null, true)
            : cb(
                new UnsupportedMediaTypeException(UNSUPPORTED_FORMAT_MESSAGE),
                false,
              ),
      }),
    }),
  ],
  controllers: [RecordingsController],
  providers: [
    UploadRecordingHandler,
    ListRecordingsHandler,
    GetRecordingUrlsHandler,
    RecordingUrlSigner,
    MeetingOwnerGuard,
    RecordingUploadInterceptor,
  ],
})
export class RecordingsModule {}
