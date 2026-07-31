import { LockMode } from '@mikro-orm/core';

import { Project } from '@/database/entities/project.entity';

import type { EntityManager } from '@mikro-orm/core';

/**
 * Serializes the renumbering of a project's ordered scopes. Positions are
 * derived from the rows already in a scope, so concurrent inserts would
 * otherwise both claim the same one.
 */
export async function lockProjectOrder(
  em: EntityManager,
  projectId: string,
): Promise<void> {
  await em.findOneOrFail(
    Project,
    { id: projectId },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  );
}
