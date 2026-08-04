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
// MikroORM cannot express `nulls not distinct`, which the ungrouped scope needs
// to be enforced at all; the migration writes the constraint by hand and the
// schema comparator sees no drift because it does not read that flag back.
@Unique({
  properties: ['project', 'group', 'position'],
  deferMode: 'deferred',
})
export class Workstream {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  /**
   * Manual order within the workstream's *scope* — the set of the project's
   * workstreams sharing one group, with ungrouped forming its own scope.
   * Positions are contiguous from 0 within each scope; every renumbering runs
   * single-phase in one locked transaction under the deferred constraint.
   */
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

  isComplete(): boolean {
    return this.getLifecycle() === WorkstreamLifecycle.Complete;
  }

  /**
   * Marks the aggregate changed after a child edit MikroORM's own change
   * tracking would not see on this row.
   */
  touch(): void {
    this.updatedAt = new Date();
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
