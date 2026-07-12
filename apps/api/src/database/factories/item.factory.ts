import { faker } from '@faker-js/faker';

import { Item } from '@/database/entities/item.entity';

import type { EntityManager } from '@mikro-orm/core';

export function createItem(
  entityManager: EntityManager,
  overrides: Partial<Item> = {},
): Item {
  const item = entityManager.create(Item, {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    ...overrides,
  });

  return item;
}
