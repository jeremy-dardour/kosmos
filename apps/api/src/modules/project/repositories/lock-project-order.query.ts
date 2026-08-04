import { LockMode } from '@mikro-orm/core';

import { Project } from '@/database/entities/project.entity';
import { assertProjectVisible } from '@/modules/project/repositories/membership.query';

import type { EntityManager } from '@mikro-orm/core';

/**
 * Serializes the renumbering of a project's ordered scopes. Positions are
 * derived from the rows already in a scope, so concurrent inserts would
 * otherwise both claim the same one.
 *
 * The ordering root is also the tenancy root: the pre-read 404s a non-member
 * before the lock is taken.
 */
export async function lockProjectOrder(
  em: EntityManager,
  projectId: string,
  currentUserId: string,
): Promise<void> {
  await assertProjectVisible(em, projectId, currentUserId);

  await em.findOneOrFail(
    Project,
    { id: projectId },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  );
}
