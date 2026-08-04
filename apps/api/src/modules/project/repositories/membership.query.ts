import type { Project } from '@/database/entities/project.entity';
import type { FilterQuery } from '@mikro-orm/core';

/**
 * The tenancy predicate (tech design D1): a non-deleted project having a
 * joined member row for the actor — pending invites (`user = null`) never
 * match, and soft-deleted projects are invisible to every content read and
 * write, including the owner's. Embed it at the resource's FK depth to
 * project; a miss surfaces as MikroORM's `NotFoundError` → 404, so project
 * existence never leaks to non-members.
 *
 * Lives inside the persistence seam (ADR 0008): only repository
 * implementations and their `.query.ts` helpers may use it.
 */
export function memberProject(actorId: string) {
  if (!actorId) {
    throw new Error('memberProject requires an actor id');
  }

  return {
    deletedAt: null,
    members: { user: actorId },
  } satisfies FilterQuery<Project>;
}
