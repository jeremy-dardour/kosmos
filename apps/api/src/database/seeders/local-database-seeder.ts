import { Seeder } from '@mikro-orm/seeder';

import type { EntityManager } from '@mikro-orm/core';

export class LocalDatabaseSeeder extends Seeder {
  async run(_entityManager: EntityManager): Promise<void> {
    // Seed data will be added when building Slice 1
  }
}
