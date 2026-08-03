interface Positioned {
  position: number;
}

/** Opens the slot at `position` by shifting it and everything after it up. */
export function openPositionGap(
  siblings: readonly Positioned[],
  position: number,
): void {
  for (const sibling of siblings) {
    if (sibling.position >= position) {
      sibling.position += 1;
    }
  }
}

/** Closes the slot a removed sibling occupied at `position`. */
export function closePositionGap(
  siblings: readonly Positioned[],
  position: number,
): void {
  for (const sibling of siblings) {
    if (sibling.position > position) {
      sibling.position -= 1;
    }
  }
}
