import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Group])],
})
export class GroupModule {}
