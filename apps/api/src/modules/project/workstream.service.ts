import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Group } from '@/database/entities/group.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
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
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

import type { AdvanceWorkstreamDto } from '@/modules/project/dtos/input/advance-workstream.dto';
import type { CreateWorkstreamDto } from '@/modules/project/dtos/input/create-workstream.dto';
import type {
  EditableChecklistItemDto,
  UpdatePipelineDto,
} from '@/modules/project/dtos/input/update-pipeline.dto';
import type { UpdateWorkstreamDto } from '@/modules/project/dtos/input/update-workstream.dto';
import type { LockedWorkstreamChanges } from '@/modules/project/repositories/workstream.repository';

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

    await this.workstreamRepository.save(workstream);

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
    if (dto.groupId !== undefined) {
      workstream.group = dto.groupId
        ? await this.findGroupInProject(dto.groupId, workstream.project.id)
        : null;
    }
    if (dto.ownerId !== undefined) {
      workstream.owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;
    }

    await this.workstreamRepository.save(workstream);

    return this.buildDto(id);
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

        throw new ProblemDetailsException(
          HttpStatus.CONFLICT,
          'workstream-not-advanceable',
          'This workstream is already complete',
        );
      },
    );

    return toWorkstreamDto(workstream);
  }

  async updatePipeline(
    id: string,
    dto: UpdatePipelineDto,
  ): Promise<WorkstreamDto> {
    const ownersById = await this.resolvePipelineOwners(dto);
    await this.workstreamRepository.updateLockedDetails(id, (workstream) =>
      this.replacePipeline(workstream, dto, ownersById),
    );

    return this.buildDto(id);
  }

  private replacePipeline(
    workstream: Workstream,
    dto: UpdatePipelineDto,
    ownersById: ReadonlyMap<string, User>,
  ): LockedWorkstreamChanges {
    const { pastSteps, editableSteps, editableById } =
      this.validatePipelineEdit(workstream, dto);

    const submittedIds = new Set(
      dto.steps.flatMap((step) => (step.id ? [step.id] : [])),
    );
    const removedSteps = editableSteps.filter(
      (step) => !submittedIds.has(step.id),
    );
    workstream.steps.remove(removedSteps);

    const removedChecklistItems: ChecklistItem[] = [];
    const firstEditablePosition = pastSteps.length + 1;
    for (const [stepIndex, submittedStep] of dto.steps.entries()) {
      const step = submittedStep.id
        ? editableById.get(submittedStep.id)!
        : new Step();
      step.workstream = workstream;
      step.position = firstEditablePosition + stepIndex;
      step.name = submittedStep.name;
      step.deadline = submittedStep.deadline;
      step.owner = submittedStep.ownerId
        ? ownersById.get(submittedStep.ownerId)!
        : null;
      step.blocked = submittedStep.blocked;

      if (!submittedStep.id) {
        workstream.steps.add(step);
      }

      removedChecklistItems.push(
        ...this.replaceChecklist(step, submittedStep.checklistItems),
      );
    }

    workstream.updatedAt = this.timestampAfter(workstream.updatedAt);

    return { removedSteps, removedChecklistItems };
  }

  private replaceChecklist(
    step: Step,
    submittedItems: EditableChecklistItemDto[],
  ): ChecklistItem[] {
    const existingItems = step.getChecklistItems();
    const existingById = new Map(existingItems.map((item) => [item.id, item]));
    const submittedIds = submittedItems.flatMap((item) =>
      item.id ? [item.id] : [],
    );

    if (
      new Set(submittedIds).size !== submittedIds.length ||
      submittedIds.some((id) => !existingById.has(id))
    ) {
      this.pipelineMismatch();
    }

    const retainedIds = new Set(submittedIds);
    const removedItems = existingItems.filter(
      (item) => !retainedIds.has(item.id),
    );
    step.checklistItems.remove(removedItems);

    for (const [itemIndex, submittedItem] of submittedItems.entries()) {
      const item = submittedItem.id
        ? existingById.get(submittedItem.id)!
        : new ChecklistItem();
      item.step = step;
      item.position = itemIndex + 1;
      item.name = submittedItem.name;
      item.done = submittedItem.done;

      if (!submittedItem.id) {
        step.checklistItems.add(item);
      }
    }

    return removedItems;
  }

  private validatePipelineEdit(
    workstream: Workstream,
    dto: UpdatePipelineDto,
  ): {
    pastSteps: Step[];
    editableSteps: Step[];
    editableById: Map<string, Step>;
  } {
    if (
      workstream.updatedAt.getTime() !==
      new Date(dto.expectedUpdatedAt).getTime()
    ) {
      this.conflict(
        'pipeline-stale',
        'This pipeline changed after editing began',
      );
    }

    const lifecycle = workstream.getLifecycle();
    if (lifecycle === WorkstreamLifecycle.Complete) {
      this.conflict(
        'step-frozen',
        'Completed workstream pipelines cannot be edited',
      );
    }

    const orderedSteps = [...workstream.getSteps()].sort(
      (left, right) => left.position - right.position,
    );
    const pastSteps = orderedSteps.filter((step) => step.outcome != null);
    const editableSteps = orderedSteps.filter((step) => step.outcome == null);
    const editableById = new Map(editableSteps.map((step) => [step.id, step]));
    const pastIds = new Set(pastSteps.map((step) => step.id));
    const submittedIds = dto.steps.flatMap((step) =>
      step.id ? [step.id] : [],
    );

    if (new Set(submittedIds).size !== submittedIds.length) {
      this.pipelineMismatch();
    }
    for (const submittedId of submittedIds) {
      if (pastIds.has(submittedId)) {
        this.conflict('step-frozen', 'Past steps cannot be edited');
      }
      if (!editableById.has(submittedId)) {
        this.pipelineMismatch();
      }
    }

    if (
      lifecycle === WorkstreamLifecycle.Active &&
      (!workstream.currentStep ||
        dto.steps[0]?.id !== workstream.currentStep.id)
    ) {
      this.conflict(
        'step-not-deletable',
        'The current step must remain first in the editable pipeline',
      );
    }

    return { pastSteps, editableSteps, editableById };
  }

  private async resolvePipelineOwners(
    dto: UpdatePipelineDto,
  ): Promise<ReadonlyMap<string, User>> {
    const ownerIds = [
      ...new Set(
        dto.steps.flatMap((step) => (step.ownerId ? [step.ownerId] : [])),
      ),
    ];
    const owners = await Promise.all(
      ownerIds.map(async (ownerId) => this.findUser(ownerId)),
    );

    return new Map(owners.map((owner) => [owner.id, owner]));
  }

  private pipelineMismatch(): never {
    return this.conflict(
      'pipeline-mismatch',
      'The submitted pipeline does not match the editable workstream tail',
    );
  }

  private conflict(typeSlug: string, detail: string): never {
    throw new ProblemDetailsException(HttpStatus.CONFLICT, typeSlug, detail);
  }

  private timestampAfter(previous: Date): Date {
    return new Date(Math.max(Date.now(), previous.getTime() + 1));
  }

  private start(workstream: Workstream): void {
    const firstStep = [...workstream.getSteps()].sort(
      (a, b) => a.position - b.position,
    )[0];

    if (!firstStep) {
      throw new ProblemDetailsException(
        HttpStatus.CONFLICT,
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

    return toWorkstreamDto(workstream);
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
