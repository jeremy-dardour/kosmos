import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Item } from '@/database/entities/item.entity';
import { ItemController } from '@/modules/item/item.controller';
import { ItemService } from '@/modules/item/item.service';

@Module({
  imports: [MikroOrmModule.forFeature([Item])],
  controllers: [ItemController],
  providers: [ItemService],
})
export class ItemModule {}
