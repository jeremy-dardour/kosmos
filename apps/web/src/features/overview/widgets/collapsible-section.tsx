import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

interface CollapsibleSectionProperties {
  title: string;
  summary?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * One stacked section of the widget panel: a header that toggles its body and
 * a summary that survives the collapse, so a shut section still says something.
 */
export const CollapsibleSection = ({
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: CollapsibleSectionProperties) => (
  <section aria-label={title}>
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-accent/60"
    >
      <ChevronDownIcon
        aria-hidden
        className={cn(
          'size-3.5 shrink-0 text-muted-foreground transition-transform',
          !isOpen && '-rotate-90',
        )}
      />
      <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      {summary && (
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {summary}
        </span>
      )}
    </button>
    {isOpen && <div className="mt-2">{children}</div>}
  </section>
);
