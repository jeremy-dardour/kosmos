import { Collection } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';

import type { Step } from '@/database/entities/step.entity';
import type { Opt } from '@mikro-orm/core';

export enum WorkstreamLifecycle {
  NotStarted = 'not_started',
  Active = 'active',
  Complete = 'complete',
}

@Entity()
// Ungrouped workstreams share one scope per project, but Postgres treats null
// group ids as distinct, so only grouped scopes are constraint-enforced.
@Unique({
  properties: ['group', 'position'],
  deferMode: 'deferred',
})
export class Workstream {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  /** Manual order within its group scope; ungrouped is its own scope. */
  @Property()
  position!: number;

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
  startedAt?: Opt<Date> | null;

  @Property({ type: 'timestamptz' })
  completedAt?: Opt<Date> | null;

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

  getLifecycle(): WorkstreamLifecycle {
    if (!this.startedAt) {
      return WorkstreamLifecycle.NotStarted;
    }

    return this.completedAt
      ? WorkstreamLifecycle.Complete
      : WorkstreamLifecycle.Active;
  }

  getSteps(): readonly Step[] {
    return this.steps.getItems();
  }

  addStep(step: Step): void {
    step.workstream = this;
    this.steps.add(step);
  }

  nearestDeadlineStep(): Step | null {
    const [nearest] = this.getSteps()
      .filter((step) => step.deadline && !step.outcome)
      .sort(
        (a, b) =>
          a.deadline!.localeCompare(b.deadline!) || a.position - b.position,
      );

    return nearest ?? null;
  }
}
