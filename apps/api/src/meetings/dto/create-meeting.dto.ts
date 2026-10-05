import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsString,
} from 'class-validator';

const normalizeEmails = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((email: unknown) =>
        typeof email === 'string' ? email.trim().toLowerCase() : email,
      )
    : value;

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsISO8601({ strict: true })
  date: string;

  @Transform(normalizeEmails)
  @IsArray()
  @IsEmail({}, { each: true })
  participants: string[];
}
