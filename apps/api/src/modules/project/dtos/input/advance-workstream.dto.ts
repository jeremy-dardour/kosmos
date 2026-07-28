import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { StepOutcome } from '@/database/entities/step.entity';

export class AdvanceWorkstreamDto {
  @ApiPropertyOptional({
    enum: StepOutcome,
    enumName: 'StepOutcome',
    description: 'Defaults to done for an active workstream',
  })
  @IsOptional()
  @IsEnum(StepOutcome)
  outcome?: StepOutcome;
}
