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
import {
  assertInsertablePosition,
  assertStepDeletable,
  assertStepEditable,
} from '@/modules/project/utils/step-mutability.util';
import { touchWorkstream } from '@/modules/project/utils/touch-workstream.util';

import type { User } from '@/database/entities/user.entity';
import type { CreateStepDto } from '@/modules/project/dtos/input/create-step.dto';
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

    await this.workstreamRepository.updateLockedDetails(
      workstreamId,
      (workstream) => {
        assertInsertablePosition(workstream, dto.position);

        for (const sibling of workstream.getSteps()) {
          if (sibling.position >= dto.position) {
            sibling.position += 1;
          }
        }

        const step = new Step();
        step.workstream = workstream;
        step.position = dto.position;
        step.name = dto.name;
        step.deadline = dto.deadline ?? null;
        step.owner = owner;
        step.blocked = false;
        workstream.steps.add(step);

        touchWorkstream(workstream);
      },
    );

    return this.buildWorkstreamDto(workstreamId);
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

        touchWorkstream(lockedWorkstream);
      },
    );

    return toStepDto(
      step,
      workstream,
      await this.workstreamRepository.countNotesByStep([workstream]),
    );
  }

  async remove(id: string): Promise<WorkstreamDto> {
    const workstream = await this.stepRepository.removeLocked(
      id,
      (step, lockedWorkstream) => {
        assertStepDeletable(lockedWorkstream, step);

        for (const sibling of lockedWorkstream.getSteps()) {
          if (sibling.position > step.position) {
            sibling.position -= 1;
          }
        }

        touchWorkstream(lockedWorkstream);
      },
    );

    return this.buildWorkstreamDto(workstream.id);
  }

  private async buildWorkstreamDto(id: string): Promise<WorkstreamDto> {
    const workstream = await this.workstreamRepository.findDetails(id);

    return toWorkstreamDto(
      workstream,
      await this.workstreamRepository.countNotesByStep([workstream]),
    );
  }

  private async findUser(userId: string): Promise<User> {
    return this.userRepository.findOneOrFail(userId);
  }
}
