import type { Group, Workstream } from '@/api/hooks/use-overview';

export interface WorkstreamGroup {
  /** null for the ungrouped bucket. */
  group: Group | null;
  workstreams: Workstream[];
}

/**
 * Clusters workstreams under their group in the order the API returned, empty
 * groups dropped and ungrouped workstreams last.
 */
export function groupWorkstreams(
  groups: Group[],
  workstreams: Workstream[],
): WorkstreamGroup[] {
  const buckets = groups.map((group) => ({
    group,
    workstreams: workstreams.filter((w) => w.groupId === group.id),
  }));

  const knownIds = new Set(groups.map((group) => group.id));
  const ungrouped = workstreams.filter(
    (w) => !w.groupId || !knownIds.has(w.groupId),
  );

  return [
    ...buckets.filter((bucket) => bucket.workstreams.length > 0),
    ...(ungrouped.length > 0 ? [{ group: null, workstreams: ungrouped }] : []),
  ];
}
