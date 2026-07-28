import { HttpStatus, Injectable } from '@nestjs/common';

import { ToggleChecklistItemDto } from '@/modules/project/dtos/input/toggle-checklist-item.dto';
import {
  ChecklistItemDto,
  toChecklistItemDto,
} from '@/modules/project/dtos/output/checklist-item.dto';
import { ChecklistItemRepository } from '@/modules/project/repositories/checklist-item.repository';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

@Injectable()
export class ChecklistItemService {
  constructor(
    private readonly checklistItemRepository: ChecklistItemRepository,
  ) {}

  async toggle(
    id: string,
    dto: ToggleChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    const item = await this.checklistItemRepository.updateLocked(
      id,
      (lockedItem, workstream) => {
        if (lockedItem.step.outcome != null) {
          throw new ProblemDetailsException(
            HttpStatus.CONFLICT,
            'step-frozen',
            'Past checklist items cannot be changed',
          );
        }

        lockedItem.done = dto.done;
        workstream.updatedAt = new Date(
          Math.max(Date.now(), workstream.updatedAt.getTime() + 1),
        );
      },
    );

    return toChecklistItemDto(item);
  }
}
