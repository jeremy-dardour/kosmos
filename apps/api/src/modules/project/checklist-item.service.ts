import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import {
  ChecklistItemDto,
  toChecklistItemDto,
} from '@/modules/project/dtos/output/checklist-item.dto';
import { ChecklistItemRepository } from '@/modules/project/repositories/checklist-item.repository';
import { closePositionGap } from '@/modules/project/utils/position-gap.util';
import { assertStepEditable } from '@/modules/project/utils/step-mutability.util';

import type { Step } from '@/database/entities/step.entity';
import type { CreateChecklistItemDto } from '@/modules/project/dtos/input/create-checklist-item.dto';
import type { UpdateChecklistItemDto } from '@/modules/project/dtos/input/update-checklist-item.dto';

/**
 * Flat item-level CRUD. Sub-item progress is informational, so nothing here
 * touches the pipeline beyond the frozen-step guard.
 */
@Injectable()
export class ChecklistItemService {
  constructor(
    private readonly checklistItemRepository: ChecklistItemRepository,
  ) {}

  async create(
    stepId: string,
    dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    const created = await this.checklistItemRepository.createLocked(
      stepId,
      (step, workstream) => {
        assertStepEditable(step);

        const item = new ChecklistItem();
        item.position = this.nextPosition(step);
        item.name = dto.name;
        item.done = false;
        step.addChecklistItem(item);
        workstream.touch();

        return item;
      },
    );

    return toChecklistItemDto(created);
  }

  async update(
    id: string,
    dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    const item = await this.checklistItemRepository.updateLocked(
      id,
      (lockedItem, workstream) => {
        assertStepEditable(lockedItem.step);

        if (dto.name !== undefined) {
          lockedItem.name = dto.name;
        }
        if (dto.done !== undefined) {
          lockedItem.done = dto.done;
        }
        workstream.touch();
      },
    );

    return toChecklistItemDto(item);
  }

  async remove(id: string): Promise<void> {
    await this.checklistItemRepository.removeLocked(id, (item, workstream) => {
      assertStepEditable(item.step);

      closePositionGap(item.step.getChecklistItems(), item.position);
      workstream.touch();
    });
  }

  /** Deletion leaves holes, so a count could collide with a surviving position. */
  private nextPosition(step: Step): number {
    const positions = step.getChecklistItems().map((item) => item.position);

    return Math.max(0, ...positions) + 1;
  }
}
