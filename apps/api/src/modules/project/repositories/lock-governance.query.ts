import { LockMode, NotFoundError } from '@mikro-orm/core';

import { Project } from '@/database/entities/project.entity';
import { assertProjectVisible } from '@/modules/project/repositories/membership.query';

import type { EntityManager } from '@mikro-orm/core';

/**
 * The governance-mutation prelude: visibility pre-read, pessimistic-write
 * lock on the project row, then a deleted re-check on the locked row — a
 * deletion racing the pre-read cannot slip a governance write onto a project
 * that is already trash. Decisions (owner, duplicates, caps) read the
 * returned locked row, so they never act on stale authority.
 */
export async function lockVisibleProject(
  em: EntityManager,
  projectId: string,
  currentUserId: string,
): Promise<Project> {
  await assertProjectVisible(em, projectId, currentUserId);
  const project = await em.findOneOrFail(
    Project,
    { id: projectId },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  );
  if (project.deletedAt) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }

  return project;
}
