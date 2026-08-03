import { Injectable } from '@nestjs/common';

import { Step } from '@/database/entities/step.entity';
import { UserRepository } from '@/database/repositories/user.repository';
import { StepDto, toStepDto } from '@/modules/project/dtos/output/step.dto';
import {
  toWorkstreamDto,
  WorkstreamDto,
} from '@/modules/project/dtos/output/workstream.dto';
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
import type { CreateStepDto } from '@/modules/project/dtos/input/create-step.dto';
import type { ReorderStepsDto } from '@/modules/project/dtos/input/reorder-steps.dto';
import type { UpdateStepDto } from '@/modules/project/dtos/input/update-step.dto';

/**
 * Granular step editing. Structural operations answer with the whole
 * workstream because they renumber siblings; field edits answer with the step.
 */
@Injectable()
export class StepService {
  constructor(
    private readonly stepRepository: StepRepository,
    private readonly workstreamRepository: WorkstreamRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(
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

        lockedWorkstream.touch();
      },
    );

    return this.buildWorkstreamDto(workstream);
  }

  async update(id: string, dto: UpdateStepDto): Promise<StepDto> {
    const owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;

    const { workstream, step } = await this.stepRepository.updateLocked(
      id,
      (lockedStep, lockedWorkstream) => {
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

        lockedWorkstream.touch();
      },
    );

    return toStepDto(
      step,
      workstream,
      await this.workstreamRepository.countNotesByStep([workstream]),
    );
  }

  async reorder(
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

        lockedWorkstream.touch();
      },
    );

    return this.buildWorkstreamDto(workstream);
  }

  async remove(id: string): Promise<WorkstreamDto> {
    const workstream = await this.stepRepository.removeLocked(
      id,
      (step, lockedWorkstream) => {
        assertStepDeletable(lockedWorkstream, step);
        closePositionGap(lockedWorkstream.getSteps(), step.position);
        lockedWorkstream.touch();
      },
    );

    return this.buildWorkstreamDto(workstream);
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
}
