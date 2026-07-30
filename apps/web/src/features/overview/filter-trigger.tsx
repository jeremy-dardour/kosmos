import { ChevronDownIcon } from 'lucide-react';

import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import type { ComponentProps } from 'react';

type FilterTriggerProperties = Omit<
  ComponentProps<typeof DropdownMenuTrigger>,
  'className'
>;

export const FilterTrigger = ({
  children,
  ...props
}: FilterTriggerProperties) => {
  return (
    <DropdownMenuTrigger
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-3 opacity-50" />
    </DropdownMenuTrigger>
  );
};
