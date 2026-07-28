import { LockMode } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { HttpStatus, Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Step } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import {
  Workstream,
  WorkstreamLifecycle,
} from '@/database/entities/workstream.entity';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

export interface PipelineChecklistItemInput {
  id?: string;
  name: string;
  done: boolean;
}

export interface PipelineStepInput {
  id?: string;
  name: string;
  deadline: string | null;
  ownerId: string | null;
  blocked: boolean;
  checklistItems: PipelineChecklistItemInput[];
}

export interface ReplacePipelineInput {
  expectedUpdatedAt: string;
  steps: PipelineStepInput[];
}

const WORKSTREAM_POPULATE = [
  'owner',
  'group',
  'currentStep',
  'steps',
  'steps.owner',
  'steps.checklistItems',
] as const;

@Injectable()
export class WorkstreamRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async findOne(id: string): Promise<Workstream> {
    return this.em.findOneOrFail(Workstream, { id });
  }

  async findDetails(id: string): Promise<Workstream> {
    return this.em.findOneOrFail(
      Workstream,
      { id },
      { populate: [...WORKSTREAM_POPULATE], refresh: true },
    );
  }

  async save(workstream: Workstream): Promise<void> {
    this.em.persist(workstream);
    await this.em.flush();
  }

  async updateLockedDetails(
    id: string,
    apply: (workstream: Workstream) => void,
  ): Promise<Workstream> {
    return this.em.transactional(async (em) => {
      const workstream = await em.findOneOrFail(
        Workstream,
        { id },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      await em.populate(workstream, [...WORKSTREAM_POPULATE]);

      apply(workstream);
      await em.flush();

      return workstream;
    });
  }

  async replacePipeline(
    id: string,
    input: ReplacePipelineInput,
  ): Promise<void> {
    await this.em.transactional(async (em) => {
      const workstream = await em.findOneOrFail(
        Workstream,
        { id },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      await em.populate(workstream, [...WORKSTREAM_POPULATE]);

      if (
        workstream.updatedAt.getTime() !==
        new Date(input.expectedUpdatedAt).getTime()
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
      const editableById = new Map(
        editableSteps.map((step) => [step.id, step]),
      );
      const pastIds = new Set(pastSteps.map((step) => step.id));
      const submittedIds = input.steps.flatMap((step) =>
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

      if (lifecycle === WorkstreamLifecycle.Active) {
        const currentStep = workstream.currentStep;
        if (!currentStep || input.steps[0]?.id !== currentStep.id) {
          this.conflict(
            'step-not-deletable',
            'The current step must remain first in the editable pipeline',
          );
        }
      }

      const retainedStepIds = new Set(submittedIds);
      for (const step of editableSteps) {
        if (retainedStepIds.has(step.id)) {
          continue;
        }
        workstream.steps.remove(step);
        em.remove(step);
      }

      const firstEditablePosition = pastSteps.length + 1;
      for (const [stepIndex, submittedStep] of input.steps.entries()) {
        const step = submittedStep.id
          ? editableById.get(submittedStep.id)!
          : em.create(Step, {
              workstream,
              position: firstEditablePosition + stepIndex,
              name: submittedStep.name,
            });

        step.position = firstEditablePosition + stepIndex;
        step.name = submittedStep.name;
        step.deadline = submittedStep.deadline;
        step.owner = submittedStep.ownerId
          ? await em.findOneOrFail(User, { id: submittedStep.ownerId })
          : null;
        step.blocked = submittedStep.blocked;

        if (!submittedStep.id) {
          workstream.steps.add(step);
        }

        this.replaceChecklist(em, step, submittedStep.checklistItems);
      }

      const nextUpdatedAt = new Date(
        Math.max(Date.now(), workstream.updatedAt.getTime() + 1),
      );
      workstream.updatedAt = nextUpdatedAt;
      await em.flush();
    });
  }

  private replaceChecklist(
    em: SqlEntityManager,
    step: Step,
    submittedItems: PipelineChecklistItemInput[],
  ): void {
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
    for (const item of existingItems) {
      if (retainedIds.has(item.id)) {
        continue;
      }
      step.checklistItems.remove(item);
      em.remove(item);
    }

    for (const [itemIndex, submittedItem] of submittedItems.entries()) {
      const item = submittedItem.id
        ? existingById.get(submittedItem.id)!
        : em.create(ChecklistItem, {
            step,
            position: itemIndex + 1,
            name: submittedItem.name,
          });
      item.position = itemIndex + 1;
      item.name = submittedItem.name;
      item.done = submittedItem.done;

      if (!submittedItem.id) {
        step.checklistItems.add(item);
      }
    }
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

  async remove(id: string): Promise<void> {
    await this.em.transactional(async (em) => {
      const workstream = await em.findOneOrFail(Workstream, { id });

      // The current-step FK is restrictive, so release it before cascading.
      workstream.currentStep = null;
      await em.flush();

      em.remove(workstream);
    });
  }
}
