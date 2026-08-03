const PORTALLED_POPUP_SELECTOR =
  '[role="menu"], [role="dialog"], [role="listbox"]';

/**
 * The click-away rule (handoff A12): pickers render in portals outside the
 * card's DOM, but a click in one of them is still a click "inside" as far as
 * an open editor is concerned — otherwise choosing an owner would dismiss the
 * editor underneath.
 */
export function isInsideCard(
  target: EventTarget | null,
  card: HTMLElement | null,
): boolean {
  if (!(target instanceof Node)) return false;
  if (card?.contains(target)) return true;

  return (
    target instanceof Element &&
    target.closest(PORTALLED_POPUP_SELECTOR) !== null
  );
}
