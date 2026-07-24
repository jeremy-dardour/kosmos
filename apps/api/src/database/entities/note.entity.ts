import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

import { Step } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';

import type { Opt } from '@mikro-orm/core';

@Entity()
@Index({ properties: ['step'] })
export class Note {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @ManyToOne(() => Step, { deleteRule: 'cascade' })
  step!: Step;

  @ManyToOne(() => User, { deleteRule: 'set null' })
  author?: User | null;

  @Property({ type: 'text' })
  content!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({
    type: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt!: Opt<Date>;
}
