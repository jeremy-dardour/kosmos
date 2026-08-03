import { useState } from 'react';

import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

/**
 * The optimistic order a drag painted, honoured only while it still spans the
 * current set — a mutation patching the cache mid-drag otherwise resurrects a
 * stale arrangement.
 */
export function applyOptimisticOrder<T extends { id: string }>(
  items: T[],
  order: readonly string[] | null,
): T[] {
  if (order?.length !== items.length) return items;

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.map((id) => byId.get(id));

  return ordered.every((item) => item !== undefined) ? ordered : items;
}

/**
 * One drag level's optimistic order plus its settled recovery contract: the
 * server owns the order, so a rejected drag is forgotten whole and the fresh
 * aggregate re-renders what the server has — retrying means dragging again
 * on fresh data. This `onError` invalidate is the one sanctioned crossover
 * from a seam-committed mutation (web standards § API layer).
 */
export function useOptimisticReorder(projectId: string | undefined): {
  order: string[] | null;
  begin: (order: string[]) => void;
  recovery: { onError: () => void; onSettled: () => void };
} {
  const invalidateOverview = useInvalidateOverview(projectId);
  const [order, setOrder] = useState<string[] | null>(null);

  return {
    order,
    begin: setOrder,
    recovery: {
      onError: () => void invalidateOverview(),
      onSettled: () => setOrder(null),
    },
  };
}
