import { Collection } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

import { Project } from '@/database/entities/project.entity';

import type { Workstream } from '@/database/entities/workstream.entity';
import type { Opt } from '@mikro-orm/core';

@Entity()
export class Group {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property()
  name!: string;

  @Property({ length: 7 })
  color!: string;

  @ManyToOne(() => Project, { deleteRule: 'cascade' })
  project!: Project;

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  @OneToMany(
    () => require('./workstream.entity').Workstream,
    (w: Workstream) => w.group,
  )
  workstreams = new Collection<Workstream>(this);

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  updatedAt!: Opt<Date>;
}
