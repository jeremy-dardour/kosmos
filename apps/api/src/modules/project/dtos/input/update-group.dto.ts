import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

import { HEX_COLOR_PATTERN } from '@/shared/constants/hex-color';
import { IsOptionalNotNull } from '@/shared/decorators/is-optional-not-null.decorator';

export class UpdateGroupDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: '#8b6cc1',
    description: 'Hex color (#rrggbb)',
  })
  @IsOptionalNotNull()
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  color?: string;
}
