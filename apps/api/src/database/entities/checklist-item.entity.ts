import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

import { Step } from '@/database/entities/step.entity';

import type { Opt } from '@mikro-orm/core';

@Entity()
@Unique({
  properties: ['step', 'position'],
  deferMode: 'deferred',
})
@Index({ properties: ['step'] })
export class ChecklistItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @ManyToOne(() => Step, { deleteRule: 'cascade' })
  step!: Step;

  @Property()
  position!: number;

  @Property()
  name!: string;

  @Property({ defaultRaw: 'false' })
  done!: Opt<boolean>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({
    type: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt!: Opt<Date>;
}
