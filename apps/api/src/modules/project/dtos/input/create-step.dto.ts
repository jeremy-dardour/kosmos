import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '@/shared/constants/calendar-date';

export class CreateStepDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    minimum: 1,
    description: '1-indexed insertion position; must be in the future zone',
  })
  @IsInt()
  @Min(1)
  position!: number;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    description: 'Calendar day (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  @Matches(CALENDAR_DATE_PATTERN)
  deadline?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Step-level override; null inherits the workstream owner',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}
