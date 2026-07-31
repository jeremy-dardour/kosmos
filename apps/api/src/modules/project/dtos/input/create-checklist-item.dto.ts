import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
