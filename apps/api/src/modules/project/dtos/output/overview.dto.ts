import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { StepStatus } from '@/database/entities/step.entity';
import { WorkstreamLifecycle } from '@/database/entities/workstream.entity';
import {
  ChecklistItemDto,
  sortChecklistItems,
  toChecklistItemDto,
} from '@/modules/project/dtos/output/checklist-item.dto';
import { GroupDto } from '@/modules/project/dtos/output/group.dto';
import { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import { sortSteps } from '@/modules/project/dtos/output/step.dto';
import { UserSummaryDto } from '@/modules/project/dtos/output/user-summary.dto';
import { resolveOwner } from '@/modules/project/utils/resolve-owner.util';

import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';
import type { StepParent } from '@/modules/project/dtos/output/step.dto';

/** A step as the overview needs it; the detail panel loads the rest. */
export class OverviewStepDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: '1-indexed position in the pipeline' })
  position!: number;

  @ApiProperty({ enum: StepStatus, enumName: 'StepStatus' })
  status!: StepStatus;

  @ApiProperty()
  blocked!: boolean;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  deadline?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Explicit step owner; null means inherit from the workstream',
  })
  explicitOwnerId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Effective owner after applying workstream inheritance',
  })
  effectiveOwnerId?: string | null;

  @ApiProperty({ type: [ChecklistItemDto] })
  checklistItems!: ChecklistItemDto[];
}

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

  @ApiProperty({ type: [OverviewStepDto] })
  steps!: OverviewStepDto[];

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

function toOverviewStepDto(
  step: Step,
  workstream: StepParent,
): OverviewStepDto {
  const owner = resolveOwner(step, workstream);

  return {
    id: step.id,
    name: step.name,
    position: step.position,
    status: step.getStatus(workstream.currentStep?.position ?? null),
    blocked: step.blocked,
    deadline: step.deadline ?? null,
    explicitOwnerId: step.owner?.id ?? null,
    effectiveOwnerId: owner?.id ?? null,
    checklistItems: sortChecklistItems(step.getChecklistItems()).map((item) =>
      toChecklistItemDto(item),
    ),
  };
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
      toOverviewStepDto(step, workstream),
    ),
    nearestDeadlineStepId: workstream.nearestDeadlineStep()?.id ?? null,
  };
}
