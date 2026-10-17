import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

// Text fields of the multipart upload. The web app omits the duration when the
// browser can't read it (e.g. WebM from MediaRecorder); it is then stored as null.
export class UploadRecordingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  durationSeconds?: number;
}
