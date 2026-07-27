import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

import { HEX_COLOR_PATTERN } from '@/shared/constants/hex-color';

export class CreateGroupDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: '#8b6cc1', description: 'Hex color (#rrggbb)' })
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  color!: string;
}
