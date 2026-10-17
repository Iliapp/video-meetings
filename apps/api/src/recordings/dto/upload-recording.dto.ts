import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

// Text fields of the multipart upload. The web app omits the duration when the
// browser can't read it (e.g. WebM from MediaRecorder); it is then stored as null.
// A blank value is invalid (400), not 0: Number('') would be 0.
export class UploadRecordingDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN,
  )
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  durationSeconds?: number;
}
