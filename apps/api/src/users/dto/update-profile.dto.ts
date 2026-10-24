import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  // Omitted keeps the stored name, null clears it. Length counts after
  // trimming, so a blank name is rejected.
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string | null;
}
