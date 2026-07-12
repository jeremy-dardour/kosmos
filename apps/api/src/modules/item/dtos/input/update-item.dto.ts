import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateItemDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsString()
  @IsOptional()
  description?: string;
}
