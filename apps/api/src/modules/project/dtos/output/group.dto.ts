import { ApiProperty } from '@nestjs/swagger';

import type { Group } from '@/database/entities/group.entity';

export class GroupDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '#8b6cc1' })
  color!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export function toGroupDto(group: Group): GroupDto {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}
