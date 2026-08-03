import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Step } from '@/database/entities/step.entity';
import { UserRepository } from '@/database/repositories/user.repository';
import {
  ChecklistItemDto,
  toChecklistItemDto,
} from '@/modules/project/dtos/output/checklist-item.dto';
import { StepDto, toStepDto } from '@/modules/project/dtos/output/step.dto';
import {
  toWorkstreamDto,
  WorkstreamDto,
} from '@/modules/project/dtos/output/workstream.dto';
import { ChecklistItemRepository } from '@/modules/project/repositories/checklist-item.repository';
import { StepRepository } from '@/modules/project/repositories/step.repository';
import { WorkstreamRepository } from '@/modules/project/repositories/workstream.repository';
import { conflict } from '@/modules/project/utils/conflict.util';
import { isExactMembership } from '@/modules/project/utils/order-membership.util';
import {
  closePositionGap,
  openPositionGap,
} from '@/modules/project/utils/position-gap.util';
import {
  assertInsertablePosition,
  assertPipelineMutable,
  assertStepDeletable,
  assertStepEditable,
  futureSteps,
} from '@/modules/project/utils/step-mutability.util';

import type { User } from '@/database/entities/user.entity';
import type { Workstream } from '@/database/entities/workstream.entity';
import type { CreateChecklistItemDto } from '@/modules/project/dtos/input/create-checklist-item.dto';
import type { CreateStepDto } from '@/modules/project/dtos/input/create-step.dto';
import type { ReorderStepsDto } from '@/modules/project/dtos/input/reorder-steps.dto';
import type { UpdateChecklistItemDto } from '@/modules/project/dtos/input/update-checklist-item.dto';
import type { UpdateStepDto } from '@/modules/project/dtos/input/update-step.dto';

/**
 * Structural mutation inside the workstream aggregate — steps and checklist
 * items. Lifecycle transitions stay in WorkstreamService.
 */
@Injectable()
export class WorkstreamStructureService {
  constructor(
    private readonly stepRepository: StepRepository,
    private readonly checklistItemRepository: ChecklistItemRepository,
    private readonly workstreamRepository: WorkstreamRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async createStep(
    workstreamId: string,
    dto: CreateStepDto,
  ): Promise<WorkstreamDto> {
    const owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;

    const workstream = await this.workstreamRepository.updateLockedDetails(
      workstreamId,
      (lockedWorkstream) => {
        assertInsertablePosition(lockedWorkstream, dto.position);
        openPositionGap(lockedWorkstream.getSteps(), dto.position);

        const step = new Step();
        step.position = dto.position;
        step.name = dto.name;
        step.deadline = dto.deadline ?? null;
        step.owner = owner;
        step.blocked = false;
        lockedWorkstream.addStep(step);
      },
    );

    return this.buildWorkstreamDto(workstream);
  }

  async updateStep(id: string, dto: UpdateStepDto): Promise<StepDto> {
    const owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;

    const { workstream, step } = await this.stepRepository.updateLocked(
      id,
      (lockedStep) => {
        assertStepEditable(lockedStep);

        if (dto.name !== undefined) {
          lockedStep.name = dto.name;
        }
        if (dto.deadline !== undefined) {
          lockedStep.deadline = dto.deadline;
        }
        if (dto.ownerId !== undefined) {
          lockedStep.owner = owner;
        }
        if (dto.blocked !== undefined) {
          lockedStep.blocked = dto.blocked;
        }
      },
    );

    return toStepDto(
      step,
      workstream,
      await this.workstreamRepository.countNotesByStep([workstream]),
    );
  }

  async reorderSteps(
    workstreamId: string,
    dto: ReorderStepsDto,
  ): Promise<WorkstreamDto> {
    const workstream = await this.workstreamRepository.updateLockedDetails(
      workstreamId,
      (lockedWorkstream) => {
        assertPipelineMutable(lockedWorkstream);

        const future = futureSteps(lockedWorkstream);
        if (
          !isExactMembership(
            dto.ids,
            future.map((step) => step.id),
          )
        ) {
          conflict(
            'order-mismatch',
            "The submitted ids do not match the workstream's future steps",
          );
        }

        // The tail keeps the position slots it already occupies, so past and
        // current steps never shift. Collisions during the rewrite resolve at
        // commit under the deferred unique constraint.
        const slots = future.map((step) => step.position);
        const byId = new Map(future.map((step) => [step.id, step]));
        for (const [index, id] of dto.ids.entries()) {
          byId.get(id)!.position = slots[index]!;
        }
      },
    );

    return this.buildWorkstreamDto(workstream);
  }

  async removeStep(id: string): Promise<WorkstreamDto> {
    const workstream = await this.stepRepository.removeLocked(
      id,
      (step, lockedWorkstream) => {
        assertStepDeletable(lockedWorkstream, step);
        closePositionGap(lockedWorkstream.getSteps(), step.position);
      },
    );

    return this.buildWorkstreamDto(workstream);
  }

  async createChecklistItem(
    stepId: string,
    dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    const created = await this.checklistItemRepository.createLocked(
      stepId,
      (step) => {
        assertStepEditable(step);

        const item = new ChecklistItem();
        item.position = this.nextChecklistPosition(step);
        item.name = dto.name;
        item.done = false;
        step.addChecklistItem(item);

        return item;
      },
    );

    return toChecklistItemDto(created);
  }

  async updateChecklistItem(
    id: string,
    dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    const item = await this.checklistItemRepository.updateLocked(
      id,
      (lockedItem) => {
        assertStepEditable(lockedItem.step);

        if (dto.name !== undefined) {
          lockedItem.name = dto.name;
        }
        if (dto.done !== undefined) {
          lockedItem.done = dto.done;
        }
      },
    );

    return toChecklistItemDto(item);
  }

  async removeChecklistItem(id: string): Promise<void> {
    await this.checklistItemRepository.removeLocked(id, (item) => {
      assertStepEditable(item.step);

      closePositionGap(item.step.getChecklistItems(), item.position);
    });
  }

  /** The locked mutation already returns the loaded graph — no re-fetch. */
  private async buildWorkstreamDto(
    workstream: Workstream,
  ): Promise<WorkstreamDto> {
    return toWorkstreamDto(
      workstream,
      await this.workstreamRepository.countNotesByStep([workstream]),
    );
  }

  private async findUser(userId: string): Promise<User> {
    return this.userRepository.findOneOrFail(userId);
  }

  private nextChecklistPosition(step: Step): number {
    const positions = step.getChecklistItems().map((item) => item.position);

    return Math.max(0, ...positions) + 1;
  }
}
