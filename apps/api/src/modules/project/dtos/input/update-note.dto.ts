import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdateNoteDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @Matches(/\S/, { message: 'content must contain a non-whitespace character' })
  @MaxLength(5000)
  content!: string;
}
