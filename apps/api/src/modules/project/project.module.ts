import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Project } from '@/database/entities/project.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Project])],
})
export class ProjectModule {}
