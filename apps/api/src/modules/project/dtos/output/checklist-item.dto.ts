import { ApiProperty } from '@nestjs/swagger';

import type { ChecklistItem } from '@/database/entities/checklist-item.entity';

export class ChecklistItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: '1-indexed position within the step' })
  position!: number;

  @ApiProperty()
  done!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export function toChecklistItemDto(item: ChecklistItem): ChecklistItemDto {
  return {
    id: item.id,
    name: item.name,
    position: item.position,
    done: item.done,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function sortChecklistItems(
  items: readonly ChecklistItem[],
): ChecklistItem[] {
  return [...items].sort(
    (a, b) =>
      a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}
