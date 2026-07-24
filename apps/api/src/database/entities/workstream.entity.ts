import { Collection } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';

import type { Step } from '@/database/entities/step.entity';
import type { Opt } from '@mikro-orm/core';

@Entity()
export class Workstream {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property()
  name!: string;

  @Property()
  icon!: string;

  @ManyToOne(() => Project, { deleteRule: 'cascade' })
  project!: Project;

  @ManyToOne(() => Group, { deleteRule: 'set null' })
  group?: Group | null;

  @ManyToOne(() => User, { deleteRule: 'set null' })
  owner?: User | null;

  @Property({ type: 'timestamptz' })
  startedAt?: Opt<Date | null>;

  @Property({ type: 'timestamptz' })
  completedAt?: Opt<Date | null>;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any -- MikroORM 7 legacy decorators don't type string entity names; runtime resolves them
  @ManyToOne(() => 'Step' as any, { deleteRule: 'restrict' })
  currentStep?: Step | null;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  @OneToMany(() => 'Step' as any, (s: Step) => s.workstream)
  steps = new Collection<Step>(this);

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({
    type: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt!: Opt<Date>;
}
