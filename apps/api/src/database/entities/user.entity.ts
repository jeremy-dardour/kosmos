import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

import type { Opt } from '@mikro-orm/core';

@Entity()
export class User {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property({ unique: true })
  email!: string;

  @Property()
  name!: string;

  @Property({ type: 'text' })
  avatarUrl?: Opt<string | null>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({
    type: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt!: Opt<Date>;
}
