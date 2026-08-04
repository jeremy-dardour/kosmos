import { LockMode, NotFoundError } from '@mikro-orm/core';

import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { memberProject } from '@/modules/project/repositories/membership.query';

import type { EntityManager } from '@mikro-orm/core';

export const WORKSTREAM_GRAPH = [
  'owner',
  'group',
  'currentStep',
  'steps',
  'steps.owner',
  'steps.checklistItems',
] as const;

/**
 * Locks the workstream row, then loads its step graph under that lock. The
 * graph is refreshed so mutability guards see committed state even when the
 * caller already touched one of these entities before taking the lock.
 *
 * The locked root is also the tenancy root — children are trusted via it
 * (ADR 0009). Membership is verified on an unlocked pre-read because
 * `FOR UPDATE` cannot ride the member join's outer join; a revoke racing the
 * lock is an accepted authorization race.
 */
export async function lockWorkstreamGraph(
  em: EntityManager,
  workstreamId: string,
  actorId: string,
): Promise<Workstream> {
  const visible = await em.count(Workstream, {
    id: workstreamId,
    project: memberProject(actorId),
  });
  if (!visible) {
    throw new NotFoundError(`Workstream ${workstreamId} not found`);
  }

  const workstream = await em.findOneOrFail(
    Workstream,
    { id: workstreamId },
    { lockMode: LockMode.PESSIMISTIC_WRITE },
  );
  await em.populate(workstream, [...WORKSTREAM_GRAPH], { refresh: true });

  return workstream;
}

/**
 * Same lock, reached from one of the workstream's steps. The step is returned
 * from the locked graph, so a concurrent delete that committed between the
 * lookup and the lock surfaces as a 404 rather than a stale entity.
 *
 * The unlocked lookup embeds the membership predicate too — a non-member must
 * get the same "Step not found" as a nonexistent id, not a workstream-level
 * miss that would confirm the step exists.
 */
export async function lockWorkstreamGraphOfStep(
  em: EntityManager,
  stepId: string,
  actorId: string,
): Promise<{ workstream: Workstream; step: Step }> {
  const unlocked = await em.findOneOrFail(
    Step,
    { id: stepId, workstream: { project: memberProject(actorId) } },
    { populate: ['workstream'] },
  );
  const workstream = await lockWorkstreamGraph(
    em,
    unlocked.workstream.id,
    actorId,
  );
  const step = workstream.getSteps().find((sibling) => sibling.id === stepId);

  if (!step) {
    // The persistence seam stays framework-free: MikroORM's NotFoundError is
    // what the exception filter maps to 404, so no NestJS import belongs here.
    throw new NotFoundError(`Step ${stepId} no longer exists`);
  }

  return { workstream, step };
}
