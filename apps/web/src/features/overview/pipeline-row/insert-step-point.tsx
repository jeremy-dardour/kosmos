import { PlusIcon } from 'lucide-react';

import { HOVER_REVEAL } from '@/features/overview/hover-reveal';
import { cn } from '@/lib/utils';

interface InsertStepPointProperties {
  label: string;
  onClick: () => void;
}

/**
 * A `+` sitting on the line between two dots, revealed on hover of the row and
 * on keyboard focus. The list item is zero-width and the button absolutely
 * positioned, so insertion points never shift the step columns — `DotCaret`
 * mirrors those widths.
 */
export const InsertStepPoint = ({
  label,
  onClick,
}: InsertStepPointProperties) => {
  return (
    <li className="relative z-10 w-0 shrink-0">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        // `top-0` + `size-5` matches the dot row's height, so the button lands
        // centred on the connector line; the row has no height of its own.
        className={cn(
          HOVER_REVEAL,
          'absolute left-1/2 top-0 flex size-5 -translate-x-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-xs hover:border-foreground/30 hover:text-foreground group-hover/dots:opacity-100',
        )}
      >
        <PlusIcon aria-hidden className="size-3" />
      </button>
    </li>
  );
};
