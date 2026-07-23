import { Collection } from '@mikro-orm/core';
import {
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

import type { Group } from '@/database/entities/group.entity';
import type { Workstream } from '@/database/entities/workstream.entity';
import type { Opt } from '@mikro-orm/core';

@Entity()
export class Project {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property()
  name!: string;

  @Property({ type: 'date' })
  eventDate?: Opt<string | null>;

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  @OneToMany(
    () => require('./workstream.entity').Workstream,
    (w: Workstream) => w.project,
  )
  workstreams = new Collection<Workstream>(this);

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  @OneToMany(() => require('./group.entity').Group, (g: Group) => g.project)
  groups = new Collection<Group>(this);

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  updatedAt!: Opt<Date>;
}
