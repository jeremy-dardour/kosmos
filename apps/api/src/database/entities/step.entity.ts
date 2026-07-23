import { Collection } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { ChecklistItem } from '@/database/entities/checklist-item.entity';
import type { Note } from '@/database/entities/note.entity';
import type { Opt } from '@mikro-orm/core';

export enum StepOutcome {
  Done = 'done',
  Skipped = 'skipped',
}

@Entity()
@Unique({
  properties: ['workstream', 'position'],
  options: { deferMode: 'deferred' },
})
@Unique({ properties: ['workstream', 'id'] })
export class Step {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @ManyToOne(() => Workstream, { deleteRule: 'cascade' })
  workstream!: Workstream;

  @Property()
  position!: number;

  @Property()
  name!: string;

  @Property({ type: 'date' })
  deadline?: Opt<string | null>;

  @ManyToOne(() => User, { deleteRule: 'set null' })
  owner?: User | null;

  @Enum({ items: () => StepOutcome, nativeEnumName: 'step_outcome' })
  outcome?: Opt<StepOutcome | null>;

  @Property({ type: 'timestamptz' })
  outcomeAt?: Opt<Date | null>;

  @Property({ defaultRaw: 'false' })
  blocked!: Opt<boolean>;

  @OneToMany(() => 'ChecklistItem', (ci: ChecklistItem) => ci.step)
  checklistItems = new Collection<ChecklistItem>(this);

  @OneToMany(() => 'Note', (n: Note) => n.step)
  notes = new Collection<Note>(this);

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  updatedAt!: Opt<Date>;
}
