import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '@/shared/constants/calendar-date';
import { IsOptionalNotNull } from '@/shared/decorators/is-optional-not-null.decorator';

export class UpdateStepDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    description: 'Calendar day (YYYY-MM-DD); null to clear',
  })
  @IsOptional()
  @IsDateString()
  @Matches(CALENDAR_DATE_PATTERN)
  deadline?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null restores inheritance from the workstream owner',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @ApiPropertyOptional({
    description: 'Informational flag; meaningful only on the current step',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  blocked?: boolean;
}
