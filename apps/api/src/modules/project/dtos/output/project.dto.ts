import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { Project } from '@/database/entities/project.entity';

export class ProjectDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  eventDate?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    eventDate: project.eventDate ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
