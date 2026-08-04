import { NotFoundError } from '@mikro-orm/core';

import { Project } from '@/database/entities/project.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { EntityManager, FilterQuery } from '@mikro-orm/core';

/**
 * The tenancy predicate (tech design D1): a non-deleted project having a
 * joined member row for the current user — pending invites (`user = null`) never
 * match, and soft-deleted projects are invisible to every content read and
 * write, including the owner's. Embed it at the resource's FK depth to
 * project; a miss surfaces as MikroORM's `NotFoundError` → 404, so project
 * existence never leaks to non-members.
 *
 * Lives inside the persistence seam (ADR 0008): only repository
 * implementations and their `.query.ts` helpers may use it.
 */
export function projectVisibleTo(currentUserId: string) {
  if (!currentUserId) {
    throw new Error('projectVisibleTo requires a user id');
  }

  return {
    deletedAt: null,
    members: { user: currentUserId },
  } satisfies FilterQuery<Project>;
}

/**
 * The unlocked tenancy pre-read the lock queries run before `FOR UPDATE`,
 * which cannot ride the member join's outer join. A revoke racing the lock
 * is an accepted authorization race.
 */
export async function assertProjectVisible(
  em: EntityManager,
  projectId: string,
  currentUserId: string,
): Promise<void> {
  const visible = await em.count(Project, {
    id: projectId,
    ...projectVisibleTo(currentUserId),
  });
  if (!visible) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }
}

/** Same pre-read, rooted one level down at a workstream. */
export async function assertWorkstreamVisible(
  em: EntityManager,
  workstreamId: string,
  currentUserId: string,
): Promise<void> {
  const visible = await em.count(Workstream, {
    id: workstreamId,
    project: projectVisibleTo(currentUserId),
  });
  if (!visible) {
    throw new NotFoundError(`Workstream ${workstreamId} not found`);
  }
}
