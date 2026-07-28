import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { StepOutcome, StepStatus } from '@/database/entities/step.entity';
import {
  ChecklistItemDto,
  sortChecklistItems,
  toChecklistItemDto,
} from '@/modules/project/dtos/output/checklist-item.dto';
import {
  UserSummaryDto,
  toUserSummaryDto,
} from '@/modules/project/dtos/output/user-summary.dto';
import { resolveOwner } from '@/modules/project/utils/resolve-owner.util';

import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';

export type StepParent = Pick<Workstream, 'owner' | 'currentStep'>;

export function sortSteps(steps: readonly Step[]): Step[] {
  return [...steps].sort((a, b) => a.position - b.position);
}

export class StepDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: '1-indexed position in the pipeline' })
  position!: number;

  @ApiProperty({
    enum: StepStatus,
    enumName: 'StepStatus',
    description: 'Derived from the workstream pointer, never stored',
  })
  status!: StepStatus;

  @ApiProperty({
    description: 'Informational flag; meaningful only on the current step',
  })
  blocked!: boolean;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  deadline?: string | null;

  @ApiPropertyOptional({
    enum: StepOutcome,
    enumName: 'StepOutcome',
    nullable: true,
  })
  outcome?: StepOutcome | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  outcomeAt?: Date | null;

  @ApiPropertyOptional({
    type: UserSummaryDto,
    nullable: true,
    description: 'Effective owner, inherited from the workstream when unset',
  })
  owner?: UserSummaryDto | null;

  @ApiProperty({ type: [ChecklistItemDto] })
  checklistItems!: ChecklistItemDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export function toStepDto(step: Step, workstream: StepParent): StepDto {
  const owner = resolveOwner(step, workstream);

  return {
    id: step.id,
    name: step.name,
    position: step.position,
    status: step.getStatus(workstream.currentStep?.position ?? null),
    blocked: step.blocked,
    deadline: step.deadline ?? null,
    outcome: step.outcome ?? null,
    outcomeAt: step.outcomeAt ?? null,
    owner: owner ? toUserSummaryDto(owner) : null,
    checklistItems: sortChecklistItems(step.getChecklistItems()).map((item) =>
      toChecklistItemDto(item),
    ),
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}
