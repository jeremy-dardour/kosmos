import { LockMode, NotFoundError } from '@mikro-orm/core';

import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';

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
 */
export async function lockWorkstreamGraph(
  em: EntityManager,
  workstreamId: string,
): Promise<Workstream> {
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
 */
export async function lockWorkstreamGraphOfStep(
  em: EntityManager,
  stepId: string,
): Promise<{ workstream: Workstream; step: Step }> {
  const unlocked = await em.findOneOrFail(
    Step,
    { id: stepId },
    { populate: ['workstream'] },
  );
  const workstream = await lockWorkstreamGraph(em, unlocked.workstream.id);
  const step = workstream.getSteps().find((sibling) => sibling.id === stepId);

  if (!step) {
    // The persistence seam stays framework-free: MikroORM's NotFoundError is
    // what the exception filter maps to 404, so no NestJS import belongs here.
    throw new NotFoundError(`Step ${stepId} no longer exists`);
  }

  return { workstream, step };
}
