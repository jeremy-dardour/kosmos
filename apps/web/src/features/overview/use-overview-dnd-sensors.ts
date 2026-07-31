import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Shared by both drag levels of the overview. The distance gate keeps plain
 * clicks on the card's dense targets from starting a drag; the keyboard sensor
 * is what makes the grip handles — plain buttons — sortable with arrow keys.
 */
export function useOverviewDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}
