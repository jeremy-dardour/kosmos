import type { Workstream } from '@/database/entities/workstream.entity';

/**
 * Marks the workstream changed after one of its steps changed, so the
 * aggregate's `updatedAt` reflects edits MikroORM's own change tracking would
 * not see.
 */
export function touchWorkstream(workstream: Workstream): void {
  workstream.updatedAt = new Date();
}
