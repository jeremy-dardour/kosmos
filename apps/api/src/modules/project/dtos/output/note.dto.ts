import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  UserSummaryDto,
  toUserSummaryDto,
} from '@/modules/project/dtos/output/user-summary.dto';

import type { Note } from '@/database/entities/note.entity';

export class NoteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  stepId!: string;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({ type: UserSummaryDto, nullable: true })
  author?: UserSummaryDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export function toNoteDto(note: Note): NoteDto {
  return {
    id: note.id,
    stepId: note.step.id,
    content: note.content,
    author: note.author ? toUserSummaryDto(note.author) : null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
