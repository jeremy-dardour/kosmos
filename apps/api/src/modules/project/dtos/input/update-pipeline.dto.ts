import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { CALENDAR_DATE_PATTERN } from '@/shared/constants/calendar-date';

export class EditableChecklistItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty()
  @IsBoolean()
  done!: boolean;
}

export class EditableStepDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    format: 'date',
    nullable: true,
    description: 'Calendar day (YYYY-MM-DD), or null to clear',
  })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsDefined()
  @IsDateString()
  @Matches(CALENDAR_DATE_PATTERN)
  deadline!: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Step-level override; null inherits the workstream owner',
  })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsDefined()
  @IsUUID()
  ownerId!: string | null;

  @ApiProperty()
  @IsBoolean()
  blocked!: boolean;

  @ApiProperty({ type: [EditableChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditableChecklistItemDto)
  checklistItems!: EditableChecklistItemDto[];
}

export class UpdatePipelineDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Workstream updatedAt value read before editing began',
  })
  @IsDateString()
  expectedUpdatedAt!: string;

  @ApiProperty({ type: [EditableStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditableStepDto)
  steps!: EditableStepDto[];
}
