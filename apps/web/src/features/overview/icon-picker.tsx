import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * A fixed set beats free text here: the OS emoji palette steals window focus
 * on some Chrome/macOS builds, leaving the inline editor with nothing to
 * insert into.
 */
const ICONS = [
  '📋',
  '📝',
  '📅',
  '✅',
  '🎯',
  '🚀',
  '📣',
  '🎨',
  '🖥️',
  '🔧',
  '🧪',
  '📊',
  '💰',
  '🧾',
  '⚖️',
  '🔑',
  '✉️',
  '📞',
  '🌐',
  '📸',
  '🎬',
  '🎵',
  '🎤',
  '🎪',
  '🎁',
  '🎂',
  '🍰',
  '🍽️',
  '🍷',
  '☕',
  '💐',
  '🌸',
  '🕯️',
  '💍',
  '👗',
  '🤵',
  '⛪',
  '🏰',
  '🏠',
  '🏨',
  '🪑',
  '📦',
  '🚚',
  '🚗',
  '✈️',
  '🗺️',
  '🐕',
  '⭐',
];

interface IconPickerProperties {
  value: string;
  /** Accessible name for the trigger. */
  label: string;
  /** Stands in for an empty value, muted. */
  placeholder?: string;
  id?: string;
  className?: string;
  onSelect: (icon: string) => void;
}

export const IconPicker = ({
  value,
  label,
  placeholder,
  id,
  className,
  onSelect,
}: IconPickerProperties) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            id={id}
            aria-label={label}
            title={label}
            className={cn(
              '-mx-1 rounded px-1 hover:bg-muted focus-visible:bg-muted',
              !value && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        {value || placeholder}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="grid w-auto min-w-0 grid-cols-8 gap-0.5 p-1.5">
        {ICONS.map((icon) => (
          <DropdownMenuItem
            key={icon}
            className="size-7 justify-center px-0 py-0 text-base"
            onClick={() => onSelect(icon)}
          >
            {icon}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
