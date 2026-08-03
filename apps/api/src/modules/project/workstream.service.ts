import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';
import { StepOutcome } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import {
  Workstream,
  WorkstreamLifecycle,
} from '@/database/entities/workstream.entity';
import { UserRepository } from '@/database/repositories/user.repository';
import {
  toWorkstreamDto,
  WorkstreamDto,
} from '@/modules/project/dtos/output/workstream.dto';
import { GroupRepository } from '@/modules/project/repositories/group.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { WorkstreamRepository } from '@/modules/project/repositories/workstream.repository';
import { conflict } from '@/modules/project/utils/conflict.util';
import { isExactMembership } from '@/modules/project/utils/order-membership.util';

import type { AdvanceWorkstreamDto } from '@/modules/project/dtos/input/advance-workstream.dto';
import type { CreateWorkstreamDto } from '@/modules/project/dtos/input/create-workstream.dto';
import type { ReorderWorkstreamsDto } from '@/modules/project/dtos/input/reorder-workstreams.dto';
import type { UpdateWorkstreamDto } from '@/modules/project/dtos/input/update-workstream.dto';

/**
 * Owns the Workstream aggregate — the only place allowed to write `startedAt`,
 * `completedAt`, `currentStep` or a step's outcome (ADR 0005).
 */
@Injectable()
export class WorkstreamService {
  constructor(
    private readonly workstreamRepository: WorkstreamRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly groupRepository: GroupRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(
    projectId: string,
    dto: CreateWorkstreamDto,
  ): Promise<WorkstreamDto> {
    const project = await this.projectRepository.findOneOrFail(projectId);

    const workstream = new Workstream();
    workstream.project = project;
    workstream.name = dto.name;
    workstream.icon = dto.icon;
    workstream.group = dto.groupId
      ? await this.findGroupInProject(dto.groupId, projectId)
      : null;
    workstream.owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;

    await this.workstreamRepository.insertAtTop(workstream);

    return this.buildDto(workstream.id);
  }

  async update(id: string, dto: UpdateWorkstreamDto): Promise<WorkstreamDto> {
    const workstream = await this.workstreamRepository.findOneOrFail(id);

    if (dto.name !== undefined) {
      workstream.name = dto.name;
    }
    if (dto.icon !== undefined) {
      workstream.icon = dto.icon;
    }
    if (dto.ownerId !== undefined) {
      workstream.owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;
    }

    const targetGroup =
      dto.groupId === undefined
        ? undefined
        : dto.groupId
          ? await this.findGroupInProject(dto.groupId, workstream.project.id)
          : null;

    if (
      targetGroup !== undefined &&
      (targetGroup?.id ?? null) !== (workstream.group?.id ?? null)
    ) {
      const sourceGroupId = workstream.group?.id ?? null;
      workstream.group = targetGroup;
      await this.workstreamRepository.moveToGroup(workstream, sourceGroupId);
    } else {
      await this.workstreamRepository.save(workstream);
    }

    return this.buildDto(id);
  }

  /** Reorders the live workstreams of one group scope (`groupId: null` = ungrouped). */
  async reorderWithinGroup(
    projectId: string,
    dto: ReorderWorkstreamsDto,
  ): Promise<WorkstreamDto[]> {
    const group = dto.groupId
      ? await this.findGroupInProject(dto.groupId, projectId)
      : null;

    const ordered = await this.workstreamRepository.reorderScope(
      projectId,
      group?.id ?? null,
      (scope) => {
        const live = scope.filter((workstream) => !workstream.isComplete());
        const byId = new Map(
          live.map((workstream) => [workstream.id, workstream]),
        );
        const memberIds = live.map((workstream) => workstream.id);

        if (!isExactMembership(dto.ids, memberIds)) {
          conflict(
            'order-mismatch',
            "The submitted ids do not match the scope's live workstreams",
          );
        }

        // Complete workstreams still share the scope's position sequence, so
        // they trail the reordered live ones in their existing relative order.
        return [
          ...dto.ids.map((id) => byId.get(id)!),
          ...scope.filter((workstream) => workstream.isComplete()),
        ];
      },
    );

    const live = ordered.slice(0, dto.ids.length);
    const noteCounts = await this.workstreamRepository.countNotesByStep(live);

    return live.map((workstream) => toWorkstreamDto(workstream, noteCounts));
  }

  async remove(id: string): Promise<void> {
    await this.workstreamRepository.remove(id);
  }

  async progress(
    id: string,
    dto: AdvanceWorkstreamDto,
  ): Promise<WorkstreamDto> {
    const workstream = await this.workstreamRepository.updateLockedDetails(
      id,
      (lockedWorkstream) => {
        const lifecycle = lockedWorkstream.getLifecycle();

        if (lifecycle === WorkstreamLifecycle.NotStarted) {
          if (dto.outcome !== undefined) {
            throw new BadRequestException(
              'An outcome cannot be provided when starting a workstream',
            );
          }
          this.start(lockedWorkstream);
          return;
        }
        if (lifecycle === WorkstreamLifecycle.Active) {
          this.advance(lockedWorkstream, dto.outcome ?? StepOutcome.Done);
          return;
        }

        conflict(
          'workstream-not-advanceable',
          'This workstream is already complete',
        );
      },
    );

    return toWorkstreamDto(
      workstream,
      await this.workstreamRepository.countNotesByStep([workstream]),
    );
  }

  private start(workstream: Workstream): void {
    const firstStep = [...workstream.getSteps()].sort(
      (a, b) => a.position - b.position,
    )[0];

    if (!firstStep) {
      conflict(
        'workstream-empty',
        'Add at least one step before starting this workstream',
      );
    }

    workstream.startedAt = new Date();
    workstream.currentStep = firstStep;
  }

  private advance(workstream: Workstream, outcome: StepOutcome): void {
    const currentStep = workstream.currentStep;
    if (!currentStep) {
      throw new InternalServerErrorException(
        'Active workstream has no current step',
      );
    }

    const nextStep = [...workstream.getSteps()]
      .sort((a, b) => a.position - b.position)
      .find((step) => step.position > currentStep.position);

    const now = new Date();
    currentStep.outcome = outcome;
    currentStep.outcomeAt = now;

    if (nextStep) {
      workstream.currentStep = nextStep;
      return;
    }

    workstream.currentStep = null;
    workstream.completedAt = now;
  }

  private async buildDto(id: string): Promise<WorkstreamDto> {
    const workstream = await this.workstreamRepository.findDetails(id);

    return toWorkstreamDto(
      workstream,
      await this.workstreamRepository.countNotesByStep([workstream]),
    );
  }

  /** Same-project guard, enforced here rather than as a composite FK (ADR 0006). */
  private async findGroupInProject(
    groupId: string,
    projectId: string,
  ): Promise<Group> {
    const group = await this.groupRepository.findOneInProject(
      groupId,
      projectId,
    );

    if (!group) {
      throw new NotFoundException(
        `Group ${groupId} does not exist in this project`,
      );
    }

    return group;
  }

  private async findUser(userId: string): Promise<User> {
    return this.userRepository.findOneOrFail(userId);
  }
}
