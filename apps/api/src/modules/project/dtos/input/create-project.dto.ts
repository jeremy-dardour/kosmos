import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '@/shared/constants/calendar-date';

export class CreateProjectDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    description: 'Event date as a calendar day (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  @Matches(CALENDAR_DATE_PATTERN)
  eventDate?: string | null;
}
