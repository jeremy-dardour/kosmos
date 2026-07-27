import type { User } from '@/database/entities/user.entity';

/** Effective owner of a step: its own owner, else the workstream's default. */
export function resolveOwner(
  step: { owner?: User | null },
  workstream: { owner?: User | null },
): User | null {
  return step.owner ?? workstream.owner ?? null;
}
