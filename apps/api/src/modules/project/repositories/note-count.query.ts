import { raw } from '@mikro-orm/core';

import { Note } from '@/database/entities/note.entity';

import type { NoteCountsByStep } from '@/modules/project/types/note-counts.type';
import type { SqlEntityManager } from '@mikro-orm/postgresql';

interface NoteCountRow {
  step_id: string;
  count: number;
}

/**
 * Repository-internal query function (Persistence seam, apps/api/STANDARDS.md;
 * ADR 0008): takes the caller's `em` so it can join the overview's
 * repeatable-read transaction.
 */
export async function countNotesByStep(
  em: SqlEntityManager,
  stepIds: readonly string[],
): Promise<NoteCountsByStep> {
  if (stepIds.length === 0) {
    return new Map();
  }

  const rows = await em
    .createQueryBuilder(Note, 'note')
    .select([raw('note.step_id'), raw('count(*)::int as count')])
    .where({ step: { $in: [...stepIds] } })
    .groupBy('note.step')
    .execute<NoteCountRow[]>('all', false);

  return new Map(rows.map((row) => [row.step_id, row.count]));
}
