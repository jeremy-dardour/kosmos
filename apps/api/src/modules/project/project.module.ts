import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Group } from '@/database/entities/group.entity';
import { Note } from '@/database/entities/note.entity';
import { Project } from '@/database/entities/project.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { GroupController } from '@/modules/project/group.controller';
import { GroupService } from '@/modules/project/group.service';
import { OverviewController } from '@/modules/project/overview.controller';
import { OverviewService } from '@/modules/project/overview.service';
import { ProjectController } from '@/modules/project/project.controller';
import { ProjectService } from '@/modules/project/project.service';
import { GroupRepository } from '@/modules/project/repositories/group.repository';
import { OverviewRepository } from '@/modules/project/repositories/overview.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { WorkstreamRepository } from '@/modules/project/repositories/workstream.repository';
import { WorkstreamController } from '@/modules/project/workstream.controller';
import { WorkstreamService } from '@/modules/project/workstream.service';

/** Owns the whole project aggregate — see docs/module-layout.md. */
@Module({
  // Entity *discovery*, not repository plumbing: with `autoLoadEntities: true`
  // an entity missing here is missing from the metadata entirely.
  imports: [
    MikroOrmModule.forFeature([
      Project,
      Group,
      Workstream,
      Step,
      ChecklistItem,
      Note,
    ]),
  ],
  controllers: [
    ProjectController,
    OverviewController,
    GroupController,
    WorkstreamController,
  ],
  providers: [
    ProjectService,
    OverviewService,
    GroupService,
    WorkstreamService,
    ProjectRepository,
    OverviewRepository,
    GroupRepository,
    WorkstreamRepository,
  ],
})
export class ProjectModule {}
