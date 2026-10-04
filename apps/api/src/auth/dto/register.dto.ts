import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from './normalize-email';

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
