import { GripVerticalIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ComponentProps } from 'react';

interface DragHandleProperties extends ComponentProps<'button'> {
  /** Accessible name, mirrored as the native tooltip. */
  label: string;
}

/**
 * The only thing that starts a drag. Hidden until its row is hovered — the
 * caller supplies the `group-hover/*:opacity-100` for its own group name — and
 * always revealed on keyboard focus. Drag wiring arrives as spread props, so
 * this stays independent of the drag library.
 */
export const DragHandle = ({
  label,
  className,
  ...dragProperties
}: DragHandleProperties) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...dragProperties}
      className={cn(
        'shrink-0 cursor-grab touch-none rounded text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing pointer-coarse:opacity-100',
        className,
      )}
    >
      <GripVerticalIcon className="size-3.5" />
    </button>
  );
};
