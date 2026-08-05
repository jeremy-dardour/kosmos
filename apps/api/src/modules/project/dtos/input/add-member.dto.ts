import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class AddMemberDto {
  /**
   * Normalized to lowercase server-side. UTF-8 local parts are rejected:
   * JS `toLowerCase()` and Postgres `lower()` disagree on a few code points,
   * which would trip the `email = lower(email)` check constraint.
   */
  @ApiProperty({ format: 'email', maxLength: 255 })
  @IsEmail({ allow_utf8_local_part: false })
  @MaxLength(255)
  email!: string;
}
