import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  // Same rule as RegisterDto.password.
  @IsString()
  @MinLength(8)
  newPassword: string;
}
