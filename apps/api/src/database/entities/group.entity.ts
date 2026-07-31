import { Collection } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

import { Project } from '@/database/entities/project.entity';

import type { Workstream } from '@/database/entities/workstream.entity';
import type { Opt } from '@mikro-orm/core';

@Entity()
@Unique({
  properties: ['project', 'position'],
  deferMode: 'deferred',
})
export class Group {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property()
  position!: number;

  @Property()
  name!: string;

  @Property({ length: 7 })
  color!: string;

  @ManyToOne(() => Project, { deleteRule: 'cascade' })
  project!: Project;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any -- MikroORM 7 legacy decorators don't type string entity names; runtime resolves them
  @OneToMany(() => 'Workstream' as any, (w: Workstream) => w.group)
  workstreams = new Collection<Workstream>(this);

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({
    type: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt!: Opt<Date>;
}
