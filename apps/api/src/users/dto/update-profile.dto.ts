import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  // `null` clears the name; a missing field fails `IsString`, so `{}` is a 400.
  @Transform(trim)
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @Length(1, 100)
  name: string | null;
}
