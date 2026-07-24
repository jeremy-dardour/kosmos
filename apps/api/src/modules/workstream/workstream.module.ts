import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Note } from '@/database/entities/note.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Workstream, Step, ChecklistItem, Note])],
})
export class WorkstreamModule {}
