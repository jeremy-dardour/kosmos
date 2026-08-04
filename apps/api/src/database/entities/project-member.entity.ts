import {
  Check,
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';

import type { Opt } from '@mikro-orm/core';

/**
 * Membership of a project, keyed by email so it can be granted before the
 * person has ever signed in: `user` stays null until first login claims it.
 */
@Entity()
@Unique({ properties: ['project', 'email'] })
@Index({ properties: ['email'] })
@Index({ properties: ['user'] })
// Lowercase is seam-enforced at every write path; the constraint stops a
// mixed-case row from dodging the attach-on-login claim or duplicating under
// the case-sensitive (project, email) unique.
@Check({ expression: 'email = lower(email)' })
export class ProjectMember {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @ManyToOne(() => Project, { deleteRule: 'cascade' })
  project!: Project;

  /** Normalized lowercase. */
  @Property()
  email!: string;

  @ManyToOne(() => User, { deleteRule: 'set null' })
  user?: User | null;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({
    type: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt!: Opt<Date>;
}
