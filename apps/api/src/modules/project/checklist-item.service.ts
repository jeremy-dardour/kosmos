import { Injectable } from '@nestjs/common';

import { ToggleChecklistItemDto } from '@/modules/project/dtos/input/toggle-checklist-item.dto';
import {
  ChecklistItemDto,
  toChecklistItemDto,
} from '@/modules/project/dtos/output/checklist-item.dto';
import { ChecklistItemRepository } from '@/modules/project/repositories/checklist-item.repository';

@Injectable()
export class ChecklistItemService {
  constructor(
    private readonly checklistItemRepository: ChecklistItemRepository,
  ) {}

  async toggle(
    id: string,
    dto: ToggleChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    const item = await this.checklistItemRepository.setDoneLocked(id, dto.done);

    return toChecklistItemDto(item);
  }
}
