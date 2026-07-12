import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

import type { Opt } from '@mikro-orm/core';

@Entity()
export class Item {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property()
  name!: string;

  @Property({ type: 'text' })
  description?: Opt<string | null>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  updatedAt!: Opt<Date>;
}
