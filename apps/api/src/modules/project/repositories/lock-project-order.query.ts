import { LockMode, NotFoundError } from '@mikro-orm/core';

import { Project } from '@/database/entities/project.entity';
import { memberProject } from '@/modules/project/repositories/membership.query';

import type { EntityManager } from '@mikro-orm/core';

/**
 * Serializes the renumbering of a project's ordered scopes. Positions are
 * derived from the rows already in a scope, so concurrent inserts would
 * otherwise both claim the same one.
 *
 * The ordering root is also the tenancy root: membership is verified on an
 * unlocked pre-read because `FOR UPDATE` cannot ride the member join's outer
 * join. A revoke racing the lock is an accepted authorization race.
 */
export async function lockProjectOrder(
  em: EntityManager,
  projectId: string,
  actorId: string,
): Promise<void> {
  const visible = await em.count(Project, {
    id: projectId,
    ...memberProject(actorId),
  });
  if (!visible) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }

  await em.findOneOrFail(
    Project,
    { id: projectId },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  );
}
