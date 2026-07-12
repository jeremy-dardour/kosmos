import { Seeder } from '@mikro-orm/seeder';

import { createItem } from '@/database/factories/item.factory';

import type { EntityManager } from '@mikro-orm/core';

export class LocalDatabaseSeeder extends Seeder {
  async run(entityManager: EntityManager): Promise<void> {
    for (let i = 0; i < 10; i++) {
      createItem(entityManager);
    }

    await entityManager.flush();
  }
}
