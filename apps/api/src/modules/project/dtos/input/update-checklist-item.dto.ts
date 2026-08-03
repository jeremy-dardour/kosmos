import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsOptionalNotNull } from '@/shared/decorators/is-optional-not-null.decorator';

export class UpdateChecklistItemDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptionalNotNull()
  @IsBoolean()
  done?: boolean;
}
