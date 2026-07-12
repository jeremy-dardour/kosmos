import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Item } from '@/database/entities/item.entity';
import { CreateItemDto } from '@/modules/item/dtos/input/create-item.dto';
import { UpdateItemDto } from '@/modules/item/dtos/input/update-item.dto';

@Injectable()
export class ItemService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: EntityRepository<Item>,
  ) {}

  async findAll(): Promise<Item[]> {
    return this.itemRepository.findAll({ orderBy: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Item> {
    return this.itemRepository.findOneOrFail({ id });
  }

  async create(createItemDto: CreateItemDto): Promise<Item> {
    const item = this.itemRepository.create(createItemDto);
    await this.itemRepository.getEntityManager().flush();
    return item;
  }

  async update(id: string, updateItemDto: UpdateItemDto): Promise<Item> {
    const item = await this.itemRepository.findOneOrFail({ id });
    const data = Object.fromEntries(
      Object.entries(updateItemDto).filter(([, v]) => v !== undefined),
    );
    this.itemRepository.assign(item, data);
    await this.itemRepository.getEntityManager().flush();
    return item;
  }

  async remove(id: string): Promise<void> {
    const item = await this.itemRepository.findOneOrFail({ id });
    const em = this.itemRepository.getEntityManager();
    em.remove(item);
    await em.flush();
  }
}
