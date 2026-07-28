import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WorkstreamLifecycle } from '@/database/entities/workstream.entity';
import { GroupDto } from '@/modules/project/dtos/output/group.dto';
import { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import {
  StepDto,
  sortSteps,
  toStepDto,
} from '@/modules/project/dtos/output/step.dto';
import { UserSummaryDto } from '@/modules/project/dtos/output/user-summary.dto';

import type { Workstream } from '@/database/entities/workstream.entity';

export class OverviewWorkstreamDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  icon!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  groupId?: string | null;

  @ApiProperty({
    enum: WorkstreamLifecycle,
    enumName: 'WorkstreamLifecycle',
  })
  lifecycle!: WorkstreamLifecycle;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ownerId?: string | null;

  @ApiProperty({ type: [StepDto] })
  steps!: StepDto[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The earliest unpassed step with a deadline',
  })
  nearestDeadlineStepId?: string | null;
}

/** The single aggregate read behind the overview screen. */
export class OverviewDto {
  @ApiProperty({ type: ProjectDto })
  project!: ProjectDto;

  @ApiProperty({ type: [GroupDto] })
  groups!: GroupDto[];

  @ApiProperty({ type: [OverviewWorkstreamDto] })
  workstreams!: OverviewWorkstreamDto[];

  @ApiProperty({
    type: [UserSummaryDto],
    description:
      'Canonical display data for every user, keyed by owner IDs elsewhere in the aggregate',
  })
  users!: UserSummaryDto[];
}

export function toOverviewWorkstreamDto(
  workstream: Workstream,
): OverviewWorkstreamDto {
  return {
    id: workstream.id,
    name: workstream.name,
    icon: workstream.icon,
    groupId: workstream.group?.id ?? null,
    lifecycle: workstream.getLifecycle(),
    ownerId: workstream.owner?.id ?? null,
    steps: sortSteps(workstream.getSteps()).map((step) =>
      toStepDto(step, workstream),
    ),
    nearestDeadlineStepId: workstream.nearestDeadlineStep()?.id ?? null,
  };
}
