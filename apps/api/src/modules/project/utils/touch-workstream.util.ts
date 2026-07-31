import type { Workstream } from '@/database/entities/workstream.entity';

/**
 * Marks the workstream changed after one of its steps changed. The timestamp is
 * forced past the previous one because it doubles as the whole-tail pipeline
 * PUT's concurrency token, which two flushes in the same millisecond would
 * otherwise leave untouched.
 */
export function touchWorkstream(workstream: Workstream): void {
  workstream.updatedAt = new Date(
    Math.max(Date.now(), workstream.updatedAt.getTime() + 1),
  );
}
