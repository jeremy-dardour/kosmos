import { LockMode } from '@mikro-orm/core';

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
