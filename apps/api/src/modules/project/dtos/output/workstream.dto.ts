import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WorkstreamLifecycle } from '@/database/entities/workstream.entity';
import {
  sortSteps,
  StepDto,
  toStepDto,
} from '@/modules/project/dtos/output/step.dto';
import {
  UserSummaryDto,
  toUserSummaryDto,
} from '@/modules/project/dtos/output/user-summary.dto';

import type { Workstream } from '@/database/entities/workstream.entity';

export class WorkstreamDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Emoji or icon name' })
  icon!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  groupId?: string | null;

  @ApiProperty({
    enum: WorkstreamLifecycle,
    enumName: 'WorkstreamLifecycle',
    description: 'Derived from (startedAt, completedAt), never stored',
  })
  lifecycle!: WorkstreamLifecycle;

  @ApiPropertyOptional({ type: UserSummaryDto, nullable: true })
  owner?: UserSummaryDto | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  currentStepId?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  startedAt?: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt?: Date | null;

  @ApiProperty({ type: [StepDto] })
  steps!: StepDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export function toWorkstreamDto(workstream: Workstream): WorkstreamDto {
  return {
    id: workstream.id,
    name: workstream.name,
    icon: workstream.icon,
    groupId: workstream.group?.id ?? null,
    lifecycle: workstream.getLifecycle(),
    owner: workstream.owner ? toUserSummaryDto(workstream.owner) : null,
    currentStepId: workstream.currentStep?.id ?? null,
    startedAt: workstream.startedAt ?? null,
    completedAt: workstream.completedAt ?? null,
    steps: sortSteps(workstream.getSteps()).map((step) =>
      toStepDto(step, workstream),
    ),
    createdAt: workstream.createdAt,
    updatedAt: workstream.updatedAt,
  };
}
