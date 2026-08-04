import { Collection } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

import { User } from '@/database/entities/user.entity';

import type { Group } from '@/database/entities/group.entity';
import type { ProjectMember } from '@/database/entities/project-member.entity';
import type { Workstream } from '@/database/entities/workstream.entity';
import type { Opt } from '@mikro-orm/core';

@Entity()
export class Project {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property()
  name!: string;

  @Property({ type: 'date' })
  eventDate?: Opt<string> | null;

  @ManyToOne(() => User, { deleteRule: 'restrict' })
  owner!: User;

  /** Set = soft-deleted: invisible to everyone but its owner's project list. */
  @Property({ type: 'timestamptz' })
  deletedAt?: Opt<Date> | null;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any -- MikroORM 7 legacy decorators don't type string entity names; runtime resolves them
  @OneToMany(() => 'Workstream' as any, (w: Workstream) => w.project)
  workstreams = new Collection<Workstream>(this);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  @OneToMany(() => 'Group' as any, (g: Group) => g.project)
  groups = new Collection<Group>(this);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  @OneToMany(() => 'ProjectMember' as any, (m: ProjectMember) => m.project)
  members = new Collection<ProjectMember>(this);

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({
    type: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt!: Opt<Date>;
}
