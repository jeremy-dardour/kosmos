import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WorkstreamLifecycle } from '@/database/entities/workstream.entity';
import {
  sortSteps,
  StepDto,
  toStepDto,
} from '@/modules/project/dtos/output/step.dto';

import type { Workstream } from '@/database/entities/workstream.entity';
import type { NoteCountsByStep } from '@/modules/project/repositories/note-count.query';

export class WorkstreamDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Manual order within its group scope; ungrouped is its own',
  })
  position!: number;

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

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ownerId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  currentStepId?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  startedAt?: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt?: Date | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The earliest unpassed step with a deadline',
  })
  nearestDeadlineStepId?: string | null;

  @ApiProperty({ type: [StepDto] })
  steps!: StepDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export function toWorkstreamDto(
  workstream: Workstream,
  noteCounts: NoteCountsByStep,
): WorkstreamDto {
  return {
    id: workstream.id,
    position: workstream.position,
    name: workstream.name,
    icon: workstream.icon,
    groupId: workstream.group?.id ?? null,
    lifecycle: workstream.getLifecycle(),
    ownerId: workstream.owner?.id ?? null,
    currentStepId: workstream.currentStep?.id ?? null,
    startedAt: workstream.startedAt ?? null,
    completedAt: workstream.completedAt ?? null,
    nearestDeadlineStepId: workstream.nearestDeadlineStep()?.id ?? null,
    steps: sortSteps(workstream.getSteps()).map((step) =>
      toStepDto(step, workstream, noteCounts),
    ),
    createdAt: workstream.createdAt,
    updatedAt: workstream.updatedAt,
  };
}
