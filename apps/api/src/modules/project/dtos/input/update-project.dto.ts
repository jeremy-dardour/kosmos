import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '@/shared/constants/calendar-date';
import { IsOptionalNotNull } from '@/shared/decorators/is-optional-not-null.decorator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    description: 'Event date as a calendar day (YYYY-MM-DD); null to clear',
  })
  @IsOptional()
  @IsDateString()
  @Matches(CALENDAR_DATE_PATTERN)
  eventDate?: string | null;
}
