import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { IsOptionalNotNull } from '@/shared/decorators/is-optional-not-null.decorator';

export class UpdateWorkstreamDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255, example: '💐' })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  icon?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null to ungroup',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null to unassign',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}
